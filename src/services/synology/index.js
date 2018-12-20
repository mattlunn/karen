import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, MOTION_DETECTED } from '../../bus';
import moment from 'moment';
import config from '../../config';
import { Event, Recording, Stay } from '../../models';
import s3 from '../s3';
import makeSynologyRequest from './instance';
import { sendNotification } from '../../helpers/notification';

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
  }, true, 5)

  const recordingDurationMs  = 10000;
  const recordingStart = moment(now).subtract(recordingDurationMs, 'milliseconds');
  const recording = recordings.data.events.find((recording) => {
    return recording.camera_name === camera
      && moment.unix(recording.startTime).isBefore(recordingStart)
      && moment.unix(recording.stopTime).isAfter(recordingStart)
  });

  if (recording === undefined) {
    throw new Error('No matching recording could be found');
  }

  const video = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'Download', {
    id: recording.id,
    offsetTimeMs: (recordingStart.format('X') - recording.startTime) * 1000,
    playTimeMs: recordingDurationMs
  }, false);

  const event = await Event.create({
    timestamp: now,
    type: 'motion',
    cameraId: recording.cameraId
  });

  await Recording.create({
    eventId: event.id,
    recording: await s3.store(video),
    size: video.length,
    start: moment(now).subtract(10, 's').toDate(),
    end: now.toDate()
  });
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