import { z } from 'zod';
import bus, { NOTIFICATION_TO_ADMINS, FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START, STAY_END } from '../bus';
import { Device, Stay } from '../models';
import dayjs, { Dayjs } from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';
import nowAndSetCron from '../helpers/now-and-set-cron';

export const parameters = z.object({
  checkCron: z.string(),
  minWarmUpRatePerHour: z.number().positive(),
  dhwAutoLeadTimeHours: z.number().positive()
});

type WarmupState = Date | null;

let currentWarmupState: WarmupState = null;

export function getPreWarmStartTime(): WarmupState {
  return currentWarmupState;
}

export default function ({
  checkCron,
  minWarmUpRatePerHour,
  dhwAutoLeadTimeHours
}: z.infer<typeof parameters>) {
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
      const targetTemperature = await thermostat.getTargetTemperature();
      if (targetTemperature === 0) {
        continue;
      }

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
    etaTime: Date
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

    // Hand DHW to the price-aware scheduler a day ahead of the ETA so it can
    // place the cylinder charge in the cheapest block before arrival. This is a
    // day-ahead decision, so it's gated independently of the thermostat warmup
    // below (an hours-ahead calculation that would otherwise return early).
    if (dayjs(etaTime).diff(dayjs(), 'hour') <= dhwAutoLeadTimeHours) {
      const heatPump = (await Device.findByCapability('HEAT_PUMP'))[0]?.getHeatPumpCapability();

      if (heatPump && await heatPump.getDHWMode() === 'OFF') {
        await heatPump.setDHWMode('AUTO');
      }
    }

    if (earliestWarmup === null || earliestWarmup.isAfter(dayjs())) {
      return;
    }

    for (const setTargetTemperature of setTargetTemperatureActors) {
      await setTargetTemperature();
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `Pre-heating started.`
    });
  }

  const runCheck = createBackgroundTransaction('automations:heating-warmup', async () => {
    const isSomeoneHome = await Stay.checkIfSomeoneHomeAt(new Date());
    const nextEta = await Stay.findNextUpcomingEta();

    if (isSomeoneHome) {
      await checkAtHomeWarmup();
    } else if (nextEta) {
      await checkAwayWarmup(nextEta.eta);
    }
  });

  nowAndSetCron(runCheck, checkCron);

  // Handles ETA being set, and (first) user home.
  bus.on(STAY_START, () => {
    runCheck();
  });

  // In case previous user has already left and set an ETA, and now the house is empty.
  bus.on(LAST_USER_LEAVES, () => {
    runCheck();
  });
}
