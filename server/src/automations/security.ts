import { Device, Arming, User, AlarmActivation, BooleanEvent } from '../models';
import { callWithKarenMessage } from '../services/twilio';
import bus, { NOTIFICATION_TO_ALL } from '../bus';
import dayjs from '../dayjs';
import sleep from '../helpers/sleep';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { ArmingMode } from '../models/arming';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { findActiveSilencingWindow, getSilencingWindowEndsAt, SilencingWindow } from '../helpers/silencing-window';

const successAsBoolean = (promise: Promise<void>) => promise.then(() => true, () => false);

type SecurityAutomationConfiguration = {
  night_mode_alexa: string;
  alarm_alexa: string;
  night_excluded_devices: string[];
  excluded_devices: string[];
  silencing_windows: SilencingWindow[];
  alarm_duration_minutes?: number;
};

async function turnOnAllTheLights() {
  const lights = await Device.findByCapability('LIGHT');

  for (const light of lights) {
    light.getLightCapability().setIsOn(true);
  }
}

async function notifyAbsentUsersOfEvent(event: BooleanEvent) {
  const usersWithNumber = await User.getAbsentUsersWithMobileNumber();
  const device = await event.getDevice();
  const message = `Motion was detected by the ${device.name} at ${dayjs(event.start).format('HH:mm:ss')}`;

  for (const user of usersWithNumber) {
    callWithKarenMessage(user, message);
  }
}

async function notifyNightModeAlexa(name: string, event: BooleanEvent) {
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

  while (!arming.end && activation.isSuppressingFurtherAlerts()) {
    if (await successAsBoolean(device.getSpeakerCapability().emitSound([
      sounds.next().value,
      sounds.next().value,
      sounds.next().value,
      sounds.next().value,
      sounds.next().value
    ]))) {
      await sleep(20000);
    }

    // Re-read the arming so we notice a disarm (the API sets arming.end when the alarm is turned
    // off) and stop sounding immediately, rather than only once the suppression window elapses.
    await arming.reload();
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
  excluded_devices: excludedDevices = [],
  silencing_windows: silencingWindows = [],
  alarm_duration_minutes: alarmDurationMinutes = 5
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
      const mostRecentActivation = await arming.getMostRecentActivation();

      // The most recent alert is still suppressing further ones (the alarm cooldown, or an
      // in-progress silencing window), so there is nothing to do.
      if (mostRecentActivation && mostRecentActivation.isSuppressingFurtherAlerts(event.start)) {
        return;
      }

      // First motion within a configured silencing window: record it and notify once so we're not
      // blind to it, but stay silent until the window ends.
      const silencingWindow = findActiveSilencingWindow(silencingWindows, event.start);

      if (silencingWindow) {
        await AlarmActivation.create({
          armingId: arming.id,
          startedAt: event.start,
          suppressFurtherAlertsUntil: getSilencingWindowEndsAt(silencingWindow, event.start)
        });

        bus.emit(NOTIFICATION_TO_ALL, {
          message: `🔕 FYI: alarm activation from ${device.name} was suppressed by the "${silencingWindow.name}" silencing window`
        });

        return;
      }

      const activation = await AlarmActivation.create({
        armingId: arming.id,
        startedAt: event.start,
        suppressFurtherAlertsUntil: dayjs(event.start).add(alarmDurationMinutes, 'minutes').toDate()
      });

      notifyAbsentUsersOfEvent(event);
      turnOnAllTheLights();

      if (arming.mode === ArmingMode.NIGHT) {
        notifyNightModeAlexa(nightModeAlexa, event);
      } else {
        soundTheAlarm(alarmAlexa, activation);
      }
    }
  }));
}
