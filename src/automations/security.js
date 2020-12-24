import bus, { EVENT_START } from '../bus';
import { Device, Arming, Stay, User, AlarmActivation, Event } from '../models';
import { call } from '../services/twilio';
import moment from 'moment';
import { say } from '../services/alexa';

async function turnOnAllTheLights() {
  const lights = await Device.findByType('light');

  for (const light of lights) {
    light.setProperty('on', true);
  }
}

async function getAbsentUsersWithMobileNumbers() {
  const [
    currentStays,
    allUsers
  ] = await Promise.all([
    Stay.findCurrentStays(),
    User.findAll()
  ]);

  return allUsers.filter(user => !!user.mobileNumber && !currentStays.some(stay => stay.userId === user.id));
}

async function notifyAbsentUsersOfEvent(event) {
  const usersWithNumber = await getAbsentUsersWithMobileNumbers();
  const device = await event.getDevice();
  const message = `Motion was detected by the ${device.name} at ${moment(event.start).format('HH:mm:ss')}`;

  for (const user of usersWithNumber) {
    call(user, `<Response><Say voice="woman">Hi ${user.handle}. This is Karen. ${message}. I repeat ${message}. Stay safe. Goodbye.</Say></Response>`);
  }
}

async function notifyNightModeAlexa(name, event) {
  const alexa = await Device.findByName(name);
  const device = await event.getDevice();
  const message = [
    '<audio src="soundbank://soundlibrary/alarms/back_up_beeps/back_up_beeps_09"/>',
    `Motion was detected by the ${device.name} at ${moment(event.start).format('HH:mm:ss')}`
  ];

  say(alexa, [
    ...message,
    ...message,
    ...message,
    ...message,
    ...message,
  ].join(''));
}

async function ensureActivation(arming, event, autoSuppressAfterMinutes) {
  const mostRecentActivation = await arming.getMostRecentActivation();

  if (mostRecentActivation) {
    const isSuppressed = mostRecentActivation.suppressed || moment(event.start).diff(mostRecentActivation.startedAt, 'minutes') > autoSuppressAfterMinutes;

    if (!isSuppressed) {
      return false;
    }
  }

  await AlarmActivation.create({
    armingId: arming.id,
    startedAt: event.start
  });

  return true;
}

async function soundTheAlarm(alarmAlexa) {
  const device = await Device.findByName(alarmAlexa);
  const message = [
    '<audio src="soundbank://soundlibrary/alarms/car_alarms/car_alarms_02"/>',
    'The alarm is on. You must identify yourself'
  ];

  say(device, [
    ...message,
    ...message,
    ...message,
    ...message,
    ...message,
  ].join(''));


}

/*
  const event = await Event.findOne({
    where: {
      id: 468157
    }
  });


  return;
*/

export default async function ({ auto_suppress_after_minutes: autoSuppressAfterMinutes, night_mode_alexa: nightModeAlexa, alarm_alexa: alarmAlexa }) {
  bus.on(EVENT_START, async (event) => {
    if (event.type === 'motion') {
      const arming = await Arming.getActiveArming(event.start);

      if (arming) {
        const isNewAlarmActivation = ensureActivation(arming, event, autoSuppressAfterMinutes);

        if (isNewAlarmActivation) {
          notifyAbsentUsersOfEvent(event);
          turnOnAllTheLights();

          if (arming.mode === Arming.MODE_NIGHT) {
            notifyNightModeAlexa(nightModeAlexa, event);
          } else {
            soundTheAlarm(alarmAlexa);
          }
        }
      }
    }
  });
}