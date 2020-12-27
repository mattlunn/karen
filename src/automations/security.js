import { Device, Arming, Stay, User, AlarmActivation, Event } from '../models';
import { call } from '../services/twilio';
import { say } from '../services/alexa';
import bus, { EVENT_START } from '../bus';
import moment from 'moment';
import sleep from '../helpers/sleep';

const successAsBoolean = (promise) => promise.then(() => true, () => false);

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

  for (let i=0;i<3;i++) {
    if (await successAsBoolean(say(alexa, [...message, ...message]))) {
      await sleep(8000);
    }
  }
}

async function soundTheAlarm(alarmAlexa, activation) {
  const device = await Device.findByName(alarmAlexa);
  const sounds = (function*() {
    for (let i=0;i<15;i++) {
      yield i % 2 === 0
        ? '<audio src="soundbank://soundlibrary/alarms/car_alarms/car_alarms_02"/>'
        : 'The alarm is on. You must identify yourself';
    }

    while (true) {
      yield '<audio src="soundbank://soundlibrary/alarms/car_alarms/car_alarm_04"/>';
    }
  }());

  while (!activation.isSuppressed) {
    if (await successAsBoolean(say(device, [
      sounds.next().value,
      sounds.next().value,
      sounds.next().value,
      sounds.next().value,
      sounds.next().value
    ]))) {
      await sleep(20000);
    }

    await activation.reload();
  }
}

export default async function ({ night_mode_alexa: nightModeAlexa, alarm_alexa: alarmAlexa, excluded_devices: excludedDevices = [] }) {
  bus.on(EVENT_START, async (event) => {
    if (event.type === 'motion') {
      const [
        arming,
        device
       ] = await Promise.all([
        Arming.getActiveArming(event.start),
        event.getDevice()
      ]);

      if (arming && !excludedDevices.includes(device.name)) {
        let mostRecentActivation = await arming.getMostRecentActivation();

        if (!mostRecentActivation || mostRecentActivation.isSuppressed) {
          mostRecentActivation = await AlarmActivation.create({
            armingId: arming.id,
            startedAt: event.start
          });

          notifyAbsentUsersOfEvent(event);
          turnOnAllTheLights();

          if (arming.mode === Arming.MODE_NIGHT) {
            notifyNightModeAlexa(nightModeAlexa, event);
          } else {
            soundTheAlarm(alarmAlexa, mostRecentActivation);
          }
        }
      }
    }
  });
}