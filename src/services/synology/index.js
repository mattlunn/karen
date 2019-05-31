import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, EVENT } from '../../bus';
import moment from 'moment';
import config from '../../config';
import { Event, Recording, Stay } from '../../models';
import s3 from '../s3';
import makeSynologyRequest from './instance';
import { sendNotification } from '../../helpers/notification';
import uuidv4 from 'uuid/v4';
import sleep from '../../helpers/sleep';

export { makeSynologyRequest };

const INACTIVITY_WINDOW_MS = 10000;
const activeCameraEvents = new Map();

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

function createEvent(cameraId, now) {
  let activeCameraEvent = await Event.findOne({
    where: {
      deviceType: 'camera',
      deviceId: cameraId,
      type: 'motion',
      end: null
    },

    order: [['start', 'DESC']]
  });

  clearTimeout(activeCameraEvents.get(cameraId));

  if (activeCameraEvent) {
    const cutoffForExtension = moment(now).subtract(INACTIVITY_WINDOW_MS, 'ms');
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

  activeCameraEvents.set(cameraId, setTimeout(async () => {
    activeCameraEvent.end = Date.now();

    await activeCameraEvent.save();
  }, INACTIVITY_WINDOW_MS));

  return activeCameraEvent;
}

async function captureRecording(event) {
  const existingRecording = await event.getRecording();
  const expectedStartOfRecording = moment(event.start).subtract(2, 's');
  const expectedEndOfRecording = moment(event.end || event.start).add(7, 's');
  let attempts = 10;
  let cameraRecording;

  do {
    await sleep(2000);

    console.log(`Trying to load recording showing ${expectedStartOfRecording} - ${expectedEndOfRecording}, with ${attempts} remaining`);

    const synologyRecordings = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'List', {
      fromTime: moment(now).startOf('day').format('X'),
      toTime: now.format('X')
    }, true, 5);

    cameraRecording = synologyRecordings.data.events.find((recording) => {
      return String(recording.cameraId) === event.deviceId
        && moment.unix(cameraRecording.startTime).isBefore(recording.start)
        && moment.unix(cameraRecording.stopTime).isAfter(recording.start);
    });
  } while (!cameraRecording && --attempts);

  if (!cameraRecording) {
    console.error(`No recording could be found covering ${now} after multiple attempts`);
  } else {
    const recordingToSave = existingRecording || Recording.build({
      eventId: event.id,
      start: expectedStartOfRecording.toDate(),
      recording: uuidv4()
    });

    const video = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'Download', {
      id: cameraRecording.id,
      offsetTimeMs: (moment(recordingToSave.start).format('X') - cameraRecording.startTime) * 1000,
      playTimeMs: expectedEndOfRecording.diff(expectedEndOfRecording)
    }, false);

    await s3.store(recordingToSave.recording, video);

    recordingToSave.size = video.length;
    recordingToSave.end = now.toDate();

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

export async function onMotionDetected(cameraId, now) {
  const event = await createEvent(cameraId, now);

  await maybeDispatchNotification(event, now);
  await captureRecording(event);
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