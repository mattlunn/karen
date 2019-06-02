import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, EVENT } from '../../bus';
import moment from 'moment';
import config from '../../config';
import { Event, Recording, Stay } from '../../models';
import s3 from '../s3';
import makeSynologyRequest from './instance';
import { sendNotification } from '../../helpers/notification';
import uuidv4 from 'uuid/v4';
import sleep from '../../helpers/sleep';
import { enqueueWorkItem } from '../../queue';

export { makeSynologyRequest };

const latestCameraEvents = new Map();

function setHomeMode(on) {
  return makeSynologyRequest('SYNO.SurveillanceStation.HomeMode', 'Switch', {
    on
  }, true);
}

bus.on(LAST_USER_LEAVES, async () => {
  try {
    await setHomeMode(false);
  } catch (e) {
    console.error(e);
  }
});

bus.on(FIRST_USER_HOME, async () => {
  try {
    await setHomeMode(true);
  } catch (e) {
    console.error(e);
  }
});

// Have a map of camera ids -> timeouts which make the last motion as ended.
// when receiving new motion, clear that timeout, and set a new one.

// On receiving motion, try find active camera event via DB query. If one exists,
// then restart timeout. If one doesn't exist, create one.

// Add an IFTTT hook which downloads footage from start -> end, +- 5 seconds.
// Add an IFTTT hook which notifies on motion

async function createEvent(cameraId, now) {
  let activeCameraEvent = await Event.findOne({
    where: {
      deviceType: 'camera',
      deviceId: cameraId,
      type: 'motion',
      end: null
    },

    order: [['start', 'DESC']]
  });

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
      deviceType: 'camera',
      deviceId: cameraId,
      type: 'motion'
    });
  }

  return activeCameraEvent;
}

async function captureRecording(event, startOfRecording, endOfRecording) {
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
      return String(recording.cameraId) === event.deviceId
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

export async function maybeDispatchNotification(event, now) {
  if (now.isSame(event.start)) {
    const isSomeoneAtHome = await Stay.checkIfSomeoneHomeAt(now)

    if (!isSomeoneAtHome) {
      sendNotification('Motion detected at ' + moment(now).format('HH:mm:ss'), 'https://karen.mattlunn.me.uk/timeline');
    }
  }
}

export async function onMotionDetected(cameraId, startOfDetectedMotion) {
  const event = await createEvent(cameraId, startOfDetectedMotion);

  latestCameraEvents.set(cameraId, startOfDetectedMotion);
  await maybeDispatchNotification(event, startOfDetectedMotion);

  setTimeout(async () => {
    const now = Date.now();

    if (latestCameraEvents.get(cameraId) === startOfDetectedMotion) {
      event.end = now;
      await event.save();
    }

    enqueueWorkItem(() => captureRecording(event, moment(event.start).subtract(2, 's'), moment(now).add(2, 's')));
  }, config.synology.length_of_motion_event_in_seconds * 1000);
}

(function removeOldUnarmedRecordings() {
  if (typeof config.days_to_keep_recordings_while_home === 'number') {
    var cutoffForUnarmedRecordings = moment().subtract(config.days_to_keep_recordings_while_home, 'days');

    Recording.findAll({
      where: {
        start: {
          $lt: cutoffForUnarmedRecordings.toDate()
        }
      },
      include: [Event]
    }).then((recordings) => {
      var promiseChain = Promise.resolve();

      recordings.forEach((recording) => {
        promiseChain = promiseChain.then(() => {
          return Stay.checkIfSomeoneHomeAt(recording.event.start).then((isHome) => {
            if (isHome) {
              return s3.remove(recording.recording).then(() => {
                return recording.destroy();
              });
            }
          });
        });
      });

      return promiseChain;
    }).catch((err) => {
      console.log('An error occurred whilst removing old unarmed recordings');
      console.log(err);
    }).then(() => {
      console.log('Old recordings removed. See you again tomorrow...');
      setTimeout(removeOldUnarmedRecordings, moment.duration(1, 'day').as('milliseconds'));
    });
  }
}());