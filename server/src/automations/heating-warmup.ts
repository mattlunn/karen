import bus, { NOTIFICATION_TO_ADMINS, FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START, STAY_END } from '../bus';
import { Device, Stay } from '../models';
import { setDHWMode, getDHWMode } from '../services/ebusd';
import dayjs, { Dayjs } from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';
import nowAndSetInterval from '../helpers/now-and-set-interval';

type HeatingWarmupParameters = {
  checkIntervalMinutes: number;
  minWarmUpRatePerHour: number;
  enableDHWControl: boolean;
};

type WarmupState = Date | null;

let currentWarmupState: WarmupState = null;

export function getPreWarmStartTime(): WarmupState {
  return currentWarmupState;
}

export default function ({
  checkIntervalMinutes,
  minWarmUpRatePerHour,
  enableDHWControl = true
}: HeatingWarmupParameters) {
  async function calculateWarmupStartTime(device: Device, nextTarget: number, targetTime: Date): Promise<Dayjs | null>{
    const [currentTemp, currentTarget] = await Promise.all([
      device.getThermostatCapability().getCurrentTemperature(),
      device.getThermostatCapability().getTargetTemperature()
    ]);

    if (nextTarget <= currentTarget) return null;

    const warmupRate = Math.max(await device.getThermostatCapability().getWarmupRate(), minWarmUpRatePerHour);

    if (warmupRate === 0) return null;

    const tempDifference = nextTarget - currentTemp;
    const hoursNeeded = tempDifference / warmupRate;

    return dayjs(targetTime).subtract(hoursNeeded, 'hour');
  }

  async function checkAtHomeWarmup(): Promise<void> {
    const thermostatDevices = await Device.findByCapability('THERMOSTAT');

    currentWarmupState = null;

    for (const device of thermostatDevices) {
      const thermostat = device.getThermostatCapability();
      const nextScheduledChange = await thermostat.getNextScheduledChange();

      if (nextScheduledChange) {
        const startTime = await calculateWarmupStartTime(device, nextScheduledChange.temperature, nextScheduledChange.timestamp);

        if (dayjs().isAfter(startTime)) {
          await thermostat.setTargetTemperatureUntilNextScheduledChange(nextScheduledChange.temperature);
        }
      }
    }
  }

  async function checkAwayWarmup(
    etaTime: Date,
    enableDHWControl: boolean
  ): Promise<void> {    
    const setTargetTemperatureActors = [];
    let earliestWarmup: Dayjs | null = null;

    for (const device of await Device.findByCapability('THERMOSTAT')) {
      const thermostat = device.getThermostatCapability();
      const scheduledTemp = await thermostat.getScheduledTemperatureAtTime(etaTime);

      if (scheduledTemp) {
        const startTime = await calculateWarmupStartTime(device, scheduledTemp, etaTime);

        if (earliestWarmup === null || startTime?.isBefore(earliestWarmup)) {
          earliestWarmup = startTime;
        }

        setTargetTemperatureActors.push(async () => {
          if (await thermostat.getNextScheduledChange() === null) {
            await thermostat.setIsOn(true);
          } else {
            await thermostat.setTargetTemperatureUntilNextScheduledChange(scheduledTemp);
          }
        });
      }
    }

    currentWarmupState = earliestWarmup?.toDate() ?? null;
    logger.info(`Calculated warmup start time ${currentWarmupState?.toISOString() ?? 'N/A'}`);

    if (earliestWarmup === null || earliestWarmup.isAfter(dayjs())) {
      return;
    }

    for (const setTargetTemperature of setTargetTemperatureActors) {
      await setTargetTemperature();
    }

    if (enableDHWControl) {
      const dhwIsOn = await getDHWMode();

      if (!dhwIsOn) {
        await setDHWMode(true);
      }
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Pre-heating started.`
    });
  }

  const intervalMs = Math.max(checkIntervalMinutes, 1) * 60 * 1000;
  const runCheck = createBackgroundTransaction('automations:heating-warmup', async () => {
    const isSomeoneHome = await Stay.checkIfSomeoneHomeAt(new Date());
    const nextEta = await Stay.findNextUpcomingEta();

    if (isSomeoneHome) {
      await checkAtHomeWarmup();
    } else if (nextEta) {
      await checkAwayWarmup(nextEta.eta, enableDHWControl);
    }
  });

  nowAndSetInterval(runCheck, intervalMs);

  // Handles ETA being set, and (first) user home.
  bus.on(STAY_START, () => {
    runCheck();
  });

  // In case previous user has already left and set an ETA, and now the house is empty.
  bus.on(LAST_USER_LEAVES, () => {
    runCheck();
  });
}
