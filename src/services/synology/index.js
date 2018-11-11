import bus, { LAST_USER_LEAVES, FIRST_USER_HOME, MOTION_DETECTED } from '../../bus';
import moment from 'moment';
import { writeFileSync } from 'fs';
import makeSynologyRequest from './instance';

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
  const recordings = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'List', {
    fromTime: moment(now).startOf('day').format('X'),
    toTime: now.format('X')
  }, true, 5);

  const recordingDurationMs  = 10000;
  const recordingStart = moment(now).subtract(recordingDurationMs, 'milliseconds');

  const recording = recordings.data.events.find((recording) => {
    return recording.camera_name === camera
      && moment.unix(recording.startTime).isBefore(recordingStart)
      && moment.unix(recording.stopTime).isAfter(recordingStart)
  });

  if (recording === undefined) {
    return res.status(400).end('No matching recording could be found');
  }

  const video = await makeSynologyRequest('SYNO.SurveillanceStation.Recording', 'Download', {
    id: recording.id,
    offsetTimeMs: (recordingStart.format('X') - recording.startTime) * 1000,
    playTimeMs: recordingDurationMs
  }, false);

  writeFileSync(__dirname + '/' + Date.now() + '.mp4', video);

  console.log('Done!');
});