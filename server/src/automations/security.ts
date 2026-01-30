import { Device, Arming, Stay, User, AlarmActivation, Event } from '../models';
import { call } from '../services/twilio';
import dayjs from '../dayjs';
import sleep from '../helpers/sleep';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { ArmingMode } from '../models/arming';
import { DeviceCapabilityEvents } from '../models/capabilities';

const successAsBoolean = (promise: Promise<void>) => promise.then(() => true, () => false);

type SecurityAutomationConfiguration = {
  night_mode_alexa: string;
  alarm_alexa: string;
  night_excluded_devices: string[];
  excluded_devices: string[];
};

async function turnOnAllTheLights() {
  const lights = await Device.findByCapability('LIGHT');

  for (const light of lights) {
    light.getLightCapability().setIsOn(true);
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

async function notifyAbsentUsersOfEvent(event: Event) {
  const usersWithNumber = await getAbsentUsersWithMobileNumbers();
  const device = await event.getDevice();
  const message = `Motion was detected by the ${device.name} at ${dayjs(event.start).format('HH:mm:ss')}`;

  for (const user of usersWithNumber) {
    call(user, `<Response><Say voice="woman">Hi ${user.handle}. This is Karen. ${message}. I repeat ${message}. Stay safe. Goodbye.</Say></Response>`);
  }
}

async function notifyNightModeAlexa(name: string, event: Event) {
  const alexa = await Device.findByNameOrError(name);
  const device = await event.getDevice();
  const message = [
    '<audio src="soundbank://soundlibrary/alarms/back_up_beeps/back_up_beeps_09"/>',
    `Motion was detected by the ${device.name} at ${dayjs(event.start).format('HH:mm:ss')}`
  ];

  for (let i=0;i<3;i++) {
    if (await successAsBoolean(alexa.getSpeakerCapability().emitSound([...message, ...message]))) {
      await sleep(8000);
    }
  }
}

async function soundTheAlarm(alarmAlexa: string, activation: AlarmActivation) {
  const [
    device,
    arming
  ] = await Promise.all([
    Device.findByNameOrError(alarmAlexa),
    activation.getArming()
  ]);

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

  while (!arming.end && !activation.isSuppressed) {
    if (await successAsBoolean(device.getSpeakerCapability().emitSound([
      sounds.next().value,
      sounds.next().value,
      sounds.next().value,
      sounds.next().value,
      sounds.next().value
    ]))) {
      await sleep(20000);
    }

    await Promise.all([
      activation.reload(),
      arming.reload()
    ]);
  }
}

function isExcludedDevice(mode: ArmingMode, deviceName: string, excludedDevices: string[], nightExcludedDevices: string[]): boolean {
  if (excludedDevices.includes(deviceName)) {
    return true;
  }

  if (mode === ArmingMode.NIGHT && nightExcludedDevices.includes(deviceName)) {
    return true;
  }

  return false;
}

export default async function ({
  night_mode_alexa: nightModeAlexa,
  alarm_alexa: alarmAlexa,
  night_excluded_devices: nightExcludedDevices = [],
  excluded_devices: excludedDevices = []
}: SecurityAutomationConfiguration) {
  DeviceCapabilityEvents.onMotionSensorHasMotionStart(createBackgroundTransaction('automations:security:motion-detected', async (event) => {
    const [
      arming,
      device
      ] = await Promise.all([
      Arming.getActiveArming(event.start),
      event.getDevice()
    ]);

    if (arming && !isExcludedDevice(arming.mode, device.name, excludedDevices, nightExcludedDevices)) {
      let mostRecentActivation = await arming.getMostRecentActivation();

      if (!mostRecentActivation || mostRecentActivation.isSuppressed) {
        mostRecentActivation = await AlarmActivation.create({
          armingId: arming.id,
          startedAt: event.start
        });

        notifyAbsentUsersOfEvent(event);
        turnOnAllTheLights();

        if (arming.mode === ArmingMode.NIGHT) {
          notifyNightModeAlexa(nightModeAlexa, event);
        } else {
          soundTheAlarm(alarmAlexa, mostRecentActivation);
        }
      }
    }
  }));
}