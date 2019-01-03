import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, MOTION_DETECTED } from '../../bus';
import moment from 'moment';
import config from '../../config';
import { Event, Recording, Stay } from '../../models';
import s3 from '../s3';
import makeSynologyRequest from './instance';
import { sendNotification } from '../../helpers/notification';
import uuidv4 from 'uuid/v4';

export { makeSynologyRequest };

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

bus.on(MOTION_DETECTED, async ({ camera, time: now }) => {
  Stay.checkIfSomeoneHomeAt(now).then(isSomeoneAtHome => {
    if (!isSomeoneAtHome) {
      sendNotification('Motion detected at ' + moment(now).format('HH:mm:ss'), 'https://karen.mattlunn.me.uk/timeline');
    }
  });

  const recordings = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'List', {
    fromTime: moment(now).startOf('day').format('X'),
    toTime: now.format('X')
  }, true, 5);
  const cameraRecordings = recordings.data.events.filter((recording) => recording.camera_name === camera);

  if (cameraRecordings.length === 0) {
    throw new Error('Camera does not exist');
  }

  const cameraId = cameraRecordings[0].cameraId;
  const latestCameraEvent = await Event.findOne({
    include: [Recording],

    where: {
      cameraId
    },

    order: [['timestamp', 'DESC']]
  });

  let recordingDurationMs = 10000;
  let expectedStartOfRecording = moment(now).subtract(recordingDurationMs, 'milliseconds');
  let recording;
  let event;

  if (latestCameraEvent && latestCameraEvent.recording && latestCameraEvent.recording.end > expectedStartOfRecording) {
    recording = latestCameraEvent.recording;
    event = latestCameraEvent;
    recordingDurationMs = moment(now).diff(recording.start, 'milliseconds');
  } else {
    event = await Event.create({
      timestamp: now,
      type: 'motion',
      cameraId
    });

    recording = Recording.build({
      eventId: event.id,
      start: expectedStartOfRecording.toDate(),
      recording: uuidv4()
    });
  }

  const cameraRecording = cameraRecordings.find((cameraRecording) => {
    return moment.unix(cameraRecording.startTime).isBefore(recording.start)
      && moment.unix(cameraRecording.stopTime).isAfter(recording.start);
  });

  if (cameraRecording === undefined) {
    console.error('No recording could be found covering ' + now);
  } else {
    const video = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'Download', {
      id: cameraRecording.id,
      offsetTimeMs: (moment(recording.start).format('X') - cameraRecording.startTime) * 1000,
      playTimeMs: recordingDurationMs
    }, false);

    await s3.store(recording.recording, video);

    recording.size = video.length;
    recording.end = now.toDate();

    await recording.save();
  }
});

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
          return Stay.checkIfSomeoneHomeAt(recording.event.timestamp).then((isHome) => {
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