import dayjs, { Dayjs } from '../../dayjs';
import config from '../../config/app';
import logger from '../../logger';
import { Event, BooleanEvent, Recording, Stay, Device, Op } from '../../models';
import s3 from '../s3';
import makeSynologyRequest from './instance';
import { v4 as uuidv4 } from 'uuid';
import sleep from '../../helpers/sleep';
import { enqueueWorkItem } from '../../queue';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ALL } from '../../bus';

export { makeSynologyRequest };

// Surveillance Station camera status: 1 = Normal/Connected. Anything else (Disconnected, Disabled,
// Migrating, etc.) means the camera isn't actively reachable.
const SYNOLOGY_CAMERA_STATUS_NORMAL = 1;
const latestCameraEvents = new Map();

type SynologyCamera = { id: number; status: number; enabled: boolean; vendor: string; model: string; newName: string };

// Have a map of camera ids -> timeouts which make the last motion as ended.
// when receiving new motion, clear that timeout, and set a new one.

// On receiving motion, try find active camera event via DB query. If one exists,
// then restart timeout. If one doesn't exist, create one.

// Download footage from start -> end, +- 5 seconds.

async function extendOrCreateMotionEvent(device: Device, now: Dayjs): Promise<BooleanEvent> {
  const motion = device.getMotionSensorCapability();
  const latestMotionEvent = await motion.getHasMotionEvent();
  const activeCameraEvent = latestMotionEvent && !latestMotionEvent.end ? latestMotionEvent : null;

  if (activeCameraEvent) {
    const cutoffForExtension = dayjs(now).subtract(config.synology.maximum_length_of_event_in_seconds, 's');
    const canExtendActiveCameraEvent = cutoffForExtension.isBefore(activeCameraEvent.start);

    if (canExtendActiveCameraEvent) {
      // setBooleanProperty's same-value handling just bumps lastReported rather than writing a
      // new row, so there's nothing new to return - the active event is still this one.
      await motion.setHasMotionState(true, now.toDate());

      return activeCameraEvent;
    }

    // Close out the event that's grown too long - the setHasMotionState(true, ...) call
    // below will then open a fresh one, rather than extending this one further.
    await motion.setHasMotionState(false, now.toDate());
  }

  return (await motion.setHasMotionState(true, now.toDate()))!;
}

async function captureRecording(event: BooleanEvent, providerId: string, startOfRecording: Dayjs, endOfRecording: Dayjs) {
  const existingRecording = await Recording.findByEventId(event.id);
  let attempts = 10;
  let cameraRecording;

  do {
    await sleep(2000);

    logger.debug(`Trying to load recording showing ${startOfRecording} - ${endOfRecording}, with ${attempts} remaining`);

    const synologyRecordings = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'List', {
      fromTime: dayjs(startOfRecording).startOf('day').format('X'),
      toTime: endOfRecording.format('X')
    }, true, 5);

    cameraRecording = synologyRecordings.events.find((recording: { cameraId: number, startTime: number, stopTime: number }) => {
      return String(recording.cameraId) === providerId
        && dayjs.unix(recording.startTime).isBefore(startOfRecording)
        && dayjs.unix(recording.stopTime).isAfter(endOfRecording);
    });
  } while (!cameraRecording && --attempts);

  if (!cameraRecording) {
    logger.warn(`No recording could be found after multiple attempts`);
  } else {
    const recordingToSave = existingRecording || Recording.build({
      eventId: event.id,
      start: startOfRecording.toDate(),
      recording: uuidv4()
    });

    const video = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'Download', {
      id: cameraRecording.id,
      offsetTimeMs: (dayjs(recordingToSave.start).unix() - cameraRecording.startTime) * 1000,
      playTimeMs: endOfRecording.diff(startOfRecording)
    }, false);

    await s3.store(recordingToSave.recording, video, 'video/mp4');

    recordingToSave.size = video.length;
    recordingToSave.end = endOfRecording.toDate();

    await recordingToSave.save();
  }
}

export async function onMotionDetected(cameraId: string, startOfDetectedMotion: Dayjs) {
  const device = await Device.findByProviderIdOrError('synology', cameraId);
  const event = await extendOrCreateMotionEvent(device, startOfDetectedMotion);

  latestCameraEvents.set(device.id, startOfDetectedMotion);

  setTimeout(async () => {
    const now = new Date();

    if (latestCameraEvents.get(device.id) === startOfDetectedMotion) {
      await device.getMotionSensorCapability().setHasMotionState(false, now);
    }

    enqueueWorkItem(() => captureRecording(event, device.providerId, dayjs(event.start).subtract(2, 's'), dayjs(now).add(2, 's')));
  }, config.synology.length_of_motion_event_in_seconds * 1000);
}

export async function onDoorbellRing(cameraId: string) {
  const now = new Date();
  const device = await Device.findByProviderIdOrError('synology', cameraId);
  const image: Buffer = await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'GetSnapshot', {
    id: 6
  }, false);

  bus.emit(NOTIFICATION_TO_ALL, {
    message: 'Someone is at the door',
    image,
    sound: 'doorbell'
  });

  const event = await device.getDoorbellCapability().setRingState(true, now);

  await s3.store(event!.id.toString(), image, 'image/jpeg');
}

setInterval(createBackgroundTransaction('synology:clear-old-recordings', async () => {
  if (typeof config.days_to_keep_recordings_while_home === 'number') {
    const cutoffForUnarmedRecordings = dayjs().subtract(config.days_to_keep_recordings_while_home, 'days');
    const recordings = await Recording.findAll({
      where: {
        start: {
          [Op.lt]: cutoffForUnarmedRecordings.toDate()
        }
      },
      include: [Event]
    });

    for (const recording of recordings) {
      const isHome = await Stay.checkIfSomeoneHomeAt(recording.event.start);

      if (isHome) {
        await s3.remove(recording.recording);
        await recording.destroy();
      }
    }

    logger.info('Old recordings removed. See you again tomorrow...');
  }
}), dayjs.duration(1, 'day').asMilliseconds());


async function updateCamerasConnectivity(cameras: SynologyCamera[]) {
  const devices = await Device.findByProvider('synology');

  await Promise.all(devices.map(async device => {
    const camera = cameras.find(c => String(c.id) === device.providerId);
    const isConnected = camera !== undefined && camera.enabled !== false && camera.status === SYNOLOGY_CAMERA_STATUS_NORMAL;
    await device.getConnectivityCapability().setIsConnectedState(isConnected);
  }));
}

async function markAllCamerasDisconnected() {
  const devices = await Device.findByProvider('synology');
  await Promise.all(devices.map(d => d.getConnectivityCapability().setIsConnectedState(false)));
}

export async function onConnectivityChanged() {
  let cameras: SynologyCamera[];

  try {
    ({ cameras } = await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'List'));
  } catch (e) {
    logger.error(e, 'Synology: failed to list cameras after connectivity webhook');
    await markAllCamerasDisconnected();
    return;
  }

  await updateCamerasConnectivity(cameras);
}

Device.registerProvider('synology', {
  getCapabilities(device) {
    return ['CAMERA', 'CONNECTIVITY', 'MOTION_SENSOR', 'DOORBELL'];
  },

  async synchronize() {
    let cameras: SynologyCamera[];

    try {
      ({ cameras } = await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'List'));
    } catch (e) {
      await markAllCamerasDisconnected();
      throw e;
    }

    for (const camera of cameras) {
      const providerId = String(camera.id);
      let knownDevice = await Device.findByProviderId('synology', providerId);

      if (!knownDevice) {
        knownDevice = Device.build({
          provider: 'synology',
          providerId
        });
      }

      knownDevice.manufacturer = camera.vendor;
      knownDevice.model = camera.model;
      knownDevice.name = camera.newName;

      await knownDevice.save();
    }

    await updateCamerasConnectivity(cameras);
  }
});