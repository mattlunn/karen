import bus, { EVENT_START, FIRST_USER_HOME } from '../bus';
import { Device, Stay } from '../models';
import { isWithinTime } from '../helpers/time';
import setIntervalForTime from '../helpers/set-interval-for-time';

// Morning
// Gets turned on when motion detected between window
// Gets turned off at fixed time

// Evening
// Gets turned on at certain time, or when someone comes home.
// Gets turned off when Karen turns off all the lights

export default function ({ switchNames, morningStart, morningEnd, eveningStart, eveningEnd }) {
  async function setDevicesOnStatus(onStatus) {
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
  bus.on(EVENT_START, async (event) => {
    if (event.type === 'motion' && isWithinTime(morningStart, morningEnd, event.start)) {
      await setDevicesOnStatus(true);
    }
  });

  // Turn off at end of morning at specified time.
  setIntervalForTime(async () => {
    await setDevicesOnStatus(false);
  }, morningEnd);

  // Turn on in the evening at certain time if someone is at home
  setIntervalForTime(async () => {
    const isSomeoneAtHome = await Stay.checkIfSomeoneHomeAt(Date.now());

    if (isSomeoneAtHome) {
      await setDevicesOnStatus(true);
    }
  }, eveningStart);

  // Otherwise turn on in the evening when someone first comes home.
  bus.on(FIRST_USER_HOME, async (event) => {
    if (isWithinTime(eveningStart, eveningEnd, event.start)) {
      await setDevicesOnStatus(true);
    }
  });
}