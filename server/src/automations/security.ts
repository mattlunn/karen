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
  alarm_duration_minutes: number;
};

async function turnOnAllTheLights() {
  const lights = await Device.findByCapability('LIGHT');

  for (const light of lights) {
    light.getLightCapability().setIsOn(true);
  }
}

async function notifyAbsentUsersOfEvent(message: string) {
  const usersWithNumber = await User.getAbsentUsersWithMobileNumber();

  for (const user of usersWithNumber) {
    callWithKarenMessage(user, message);
  }
}

async function notifyNightModeAlexa(name: string, message: string) {
  const alexa = await Device.findByNameOrError(name);
  const audio = [
    '<audio src="soundbank://soundlibrary/alarms/back_up_beeps/back_up_beeps_09"/>',
    message
  ];

  for (let i=0;i<3;i++) {
    if (await successAsBoolean(alexa.getSpeakerCapability().emitSound([...audio, ...audio]))) {
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
  alarm_duration_minutes: alarmDurationMinutes
}: SecurityAutomationConfiguration) {
  // config/automations.json is plain JSON, so SecurityAutomationConfiguration buys us nothing at
  // runtime. Check the parameter here instead: a missing one used to surface as an "Invalid date"
  // insert failure at the moment the alarm was needed, silently swallowing the alert.
  if (typeof alarmDurationMinutes !== 'number' || !Number.isFinite(alarmDurationMinutes)) {
    throw new Error(`security: alarm_duration_minutes must be a number, but got ${JSON.stringify(alarmDurationMinutes)}`);
  }

  async function handleTrigger(event: BooleanEvent, describeTrigger: (deviceName: string) => string) {
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

      const description = describeTrigger(device.name);

      // First trigger within a configured silencing window: record it and notify once so we're not
      // blind to it, but stay silent until the window ends.
      const silencingWindow = findActiveSilencingWindow(silencingWindows, event.start);

      if (silencingWindow) {
        const suppressFurtherAlertsUntil = getSilencingWindowEndsAt(silencingWindow, event.start);

        await AlarmActivation.create({
          armingId: arming.id,
          startedAt: event.start,
          suppressFurtherAlertsUntil,
          triggeringDeviceId: device.id
        });

        bus.emit(NOTIFICATION_TO_ALL, {
          message: `🔕 ${description}. Further alerts will be suppressed until ${dayjs(suppressFurtherAlertsUntil).format('HH:mm')}.`
        });

        return;
      }

      const activation = await AlarmActivation.create({
        armingId: arming.id,
        startedAt: event.start,
        suppressFurtherAlertsUntil: dayjs(event.start).add(alarmDurationMinutes, 'minutes').toDate(),
        triggeringDeviceId: device.id
      });

      notifyAbsentUsersOfEvent(description);
      turnOnAllTheLights();

      if (arming.mode === ArmingMode.NIGHT) {
        notifyNightModeAlexa(nightModeAlexa, description);
      } else {
        soundTheAlarm(alarmAlexa, activation);
      }
    }
  }

  DeviceCapabilityEvents.onMotionSensorHasMotionStart(createBackgroundTransaction('automations:security:motion-detected', (event) => {
    return handleTrigger(event, (deviceName) => `Motion was detected by the ${deviceName} at ${dayjs(event.start).format('HH:mm:ss')}`);
  }));

  DeviceCapabilityEvents.onContactSensorIsOpenStart(createBackgroundTransaction('automations:security:contact-sensor-opened', (event) => {
    return handleTrigger(event, (deviceName) => `The ${deviceName} was opened at ${dayjs(event.start).format('HH:mm:ss')}`);
  }));
}
