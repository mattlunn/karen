import bus, { FIRST_USER_HOME } from '../bus';
import { Device, Stay, Event } from '../models';
import { isWithinTime } from '../helpers/time';
import setIntervalForTime from '../helpers/set-interval-for-time';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';

// Morning
// Gets turned on when motion detected between window
// Gets turned off at fixed time

// Evening
// Gets turned on at certain time, or when someone comes home.
// Gets turned off when Karen turns off all the lights

type ChristmasTreeAutomationParameters = {
  switchNames: string[];
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
};

export default function ({ switchNames, morningStart, morningEnd, eveningStart, eveningEnd }: ChristmasTreeAutomationParameters) {
  async function setDevicesOnStatus(onStatus: boolean) {
    return Promise.all(switchNames.map(async (switchName) => {
      const device = await Device.findByName(switchName);

      if (device) {
        const isOn = await device.getLightCapability().getIsOn();

        if (isOn !== onStatus) {
          await device.getLightCapability().setIsOn(onStatus);
        }
      }
    }));
  }

  // Turn on in the morning when motion first detected.
  DeviceCapabilityEvents.onMotionSensorHasMotionStart(createBackgroundTransaction('automations:christmas:motion-started', async (event: Event) => {
    if (isWithinTime(morningStart, morningEnd, event.start)) {
      await setDevicesOnStatus(true);
    }
  }));

  // Turn off at end of morning at specified time.
  setIntervalForTime(async () => {
    await setDevicesOnStatus(false);
  }, morningEnd);

  // Turn on in the evening at certain time if someone is at home
  setIntervalForTime(async () => {
    const isSomeoneAtHome = await Stay.checkIfSomeoneHomeAt(new Date());

    if (isSomeoneAtHome) {
      await setDevicesOnStatus(true);
    }
  }, eveningStart);

  // Otherwise turn on in the evening when someone first comes home.
  bus.on(FIRST_USER_HOME, async (event) => {
    if (isWithinTime(eveningStart, eveningEnd, event.arrival!)) {
      await setDevicesOnStatus(true);
    }
  });

  // Turn off last thing at night
  setIntervalForTime(async () => {
    await setDevicesOnStatus(false);
  }, eveningEnd);
}