import moment from 'moment';
import config from '../../config';
import { Event, Recording, Stay, Device } from '../../models';
import s3 from '../s3';
import makeSynologyRequest from './instance';
import uuidv4 from 'uuid/v4';
import sleep from '../../helpers/sleep';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { enqueueWorkItem } from '../../queue';
import { createBackgroundTransaction } from '../../helpers/newrelic';

export { makeSynologyRequest };

const latestCameraEvents = new Map();

// Have a map of camera ids -> timeouts which make the last motion as ended.
// when receiving new motion, clear that timeout, and set a new one.

// On receiving motion, try find active camera event via DB query. If one exists,
// then restart timeout. If one doesn't exist, create one.

// Add an IFTTT hook which downloads footage from start -> end, +- 5 seconds.
// Add an IFTTT hook which notifies on motion

async function createEvent(device, now) {
  const latestCameraEvent = await device.getLatestEvent('motion');
  let activeCameraEvent = latestCameraEvent && !latestCameraEvent.end ? latestCameraEvent : null;

  if (activeCameraEvent) {
    const cutoffForExtension = moment(now).subtract(config.synology.maximum_length_of_event_in_seconds, 's');
    const canExtendActiveCameraEvent = cutoffForExtension.isBefore(activeCameraEvent.start);

    if (!canExtendActiveCameraEvent) {
      activeCameraEvent.end = now;
      await activeCameraEvent.save();

      activeCameraEvent = null;
    }
  }

  if (!activeCameraEvent) {
    activeCameraEvent = await Event.create({
      start: now,
      deviceId: device.id,
      type: 'motion'
    });
  }

  return activeCameraEvent;
}

async function captureRecording(event, providerId, startOfRecording, endOfRecording) {
  const existingRecording = await event.getRecording();
  let attempts = 10;
  let cameraRecording;

  do {
    await sleep(2000);

    console.log(`Trying to load recording showing ${startOfRecording} - ${endOfRecording}, with ${attempts} remaining`);

    const synologyRecordings = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'List', {
      fromTime: moment(startOfRecording).startOf('day').format('X'),
      toTime: endOfRecording.format('X')
    }, true, 5);

    cameraRecording = synologyRecordings.data.events.find((recording) => {
      return String(recording.cameraId) === providerId
        && moment.unix(recording.startTime).isBefore(startOfRecording)
        && moment.unix(recording.stopTime).isAfter(endOfRecording);
    });
  } while (!cameraRecording && --attempts);

  if (!cameraRecording) {
    console.error(`No recording could be found after multiple attempts`);
  } else {
    const recordingToSave = existingRecording || Recording.build({
      eventId: event.id,
      start: startOfRecording.toDate(),
      recording: uuidv4()
    });

    const video = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'Download', {
      id: cameraRecording.id,
      offsetTimeMs: (moment(recordingToSave.start).format('X') - cameraRecording.startTime) * 1000,
      playTimeMs: endOfRecording.diff(startOfRecording)
    }, false);

    await s3.store(recordingToSave.recording, video);

    recordingToSave.size = video.length;
    recordingToSave.end = endOfRecording;

    await recordingToSave.save();
  }
}

export async function onMotionDetected(cameraId, startOfDetectedMotion) {
  const device = await Device.findByProviderId('synology', cameraId);
  const event = await createEvent(device, startOfDetectedMotion);

  latestCameraEvents.set(device.id, startOfDetectedMotion);

  setTimeout(async () => {
    const now = Date.now();

    if (latestCameraEvents.get(device.id) === startOfDetectedMotion) {
      event.end = now;
      await event.save();
    }

    enqueueWorkItem(() => captureRecording(event, device.providerId, moment(event.start).subtract(2, 's'), moment(now).add(2, 's')));
  }, config.synology.length_of_motion_event_in_seconds * 1000);
}

nowAndSetInterval(createBackgroundTransaction('synology:clear-old-recordings', async () => {
  if (typeof config.days_to_keep_recordings_while_home === 'number') {
    const cutoffForUnarmedRecordings = moment().subtract(config.days_to_keep_recordings_while_home, 'days');
    const recordings = await Recording.findAll({
      where: {
        start: {
          $lt: cutoffForUnarmedRecordings.toDate()
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

    console.log('Old recordings removed. See you again tomorrow...');
  }
}), moment.duration(1, 'day').as('milliseconds'));

Device.registerProvider('synology', {
  async setProperty(device, key, value) {
    throw new Error(`Unable to handle setting '${key}' for ${device.type}`);
  },

  async getProperty(device, key) {
    throw new Error(`Unable to handle retrieving '${key}' for ${device.type}`);
  },

  async synchronize() {
    const { data: { cameras }} = await makeSynologyRequest('SYNO.SurveillanceStation.Camera', 'List');

    for (const camera of cameras) {
      let knownDevice = await Device.findByProviderId('synology', camera.id);

      if (!knownDevice) {
        knownDevice = Device.build({
          provider: 'synology',
          providerId: camera.id,
          type: 'camera'
        });
      }

      knownDevice.name = camera.newName;

      await knownDevice.save();
    }
  }
});