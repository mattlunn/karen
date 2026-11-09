import { z } from 'zod';
import bus, { FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START, STAY_END } from '../bus';
import { Device, Log, Stay } from '../models';
import dayjs, { Dayjs } from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';
import nowAndSetCron from '../helpers/now-and-set-cron';
import { findTimeWindowContaining } from '../helpers/time';
import { timeRange } from './schema';

export const parameters = z.object({
  checkCron: z.string(),
  minWarmUpRatePerHour: z.number().positive(),
  dhwAutoLeadTimeHours: z.number().positive(),
  targetOffsetWindows: z.array(timeRange.extend({ offset: z.number() }))
});

type WarmupState = Date | null;

let currentWarmupState: WarmupState = null;

interface OffsetWindow {
  end: Date;
  offset: number;
}

function isSameTemperature(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

export function getPreWarmStartTime(): WarmupState {
  return currentWarmupState;
}

export default function ({
  checkCron,
  minWarmUpRatePerHour,
  dhwAutoLeadTimeHours,
  targetOffsetWindows
}: z.infer<typeof parameters>) {
  function findOffsetWindowAt(time: Date): OffsetWindow | null {
    for (const { start, end, offset } of targetOffsetWindows) {
      const occurrence = findTimeWindowContaining(start, end, time);

      if (occurrence !== null) {
        return { end: occurrence.end, offset };
      }
    }

    return null;
  }

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

  // The next scheduled temperature, once it's time to start warming up to it.
  async function getDueWarmupTarget(device: Device): Promise<number | null> {
    const nextScheduledChange = await device.getThermostatCapability().getNextScheduledChange();

    if (nextScheduledChange === null) {
      return null;
    }

    const startTime = await calculateWarmupStartTime(device, nextScheduledChange.temperature, nextScheduledChange.timestamp);

    return startTime !== null && dayjs().isAfter(startTime) ? nextScheduledChange.temperature : null;
  }

  async function checkAtHomeWarmup(window: OffsetWindow | null): Promise<void> {
    const thermostatDevices = await Device.findByCapability('THERMOSTAT');

    currentWarmupState = null;

    for (const device of thermostatDevices) {
      const thermostat = device.getThermostatCapability();
      const targetTemperature = await thermostat.getTargetTemperature();
      if (targetTemperature === 0) {
        continue;
      }

      const warmupTarget = await getDueWarmupTarget(device);

      if (window === null) {
        if (warmupTarget !== null) {
          await thermostat.setTargetTemperatureUntilNextScheduledChange(warmupTarget);
        }

        continue;
      }

      const scheduled = await thermostat.getScheduledTemperatureAtTime(new Date());

      if (scheduled === null) {
        continue;
      }

      // Any other target was set by hand, or is an override (this window's
      // offset included) that stands until it lapses.
      const isUntouched = isSameTemperature(targetTemperature, scheduled)
        || (warmupTarget !== null && isSameTemperature(targetTemperature, warmupTarget));

      if (isUntouched) {
        const base = warmupTarget ?? scheduled;
        const target = base + window.offset;

        await thermostat.setTargetTemperatureUntil(target, window.end);
        logger.info(`Heating: ${device.name} target ${target}°C (${base}°C ${window.offset >= 0 ? '+' : ''}${window.offset}) until ${window.end.toISOString()}`);
      }
    }
  }

  async function checkAwayWarmup(
    etaTime: Date
  ): Promise<void> {
    const warmups: { device: Device, start: () => Promise<void> }[] = [];
    const etaWindow = findOffsetWindowAt(etaTime);
    let earliestWarmup: Dayjs | null = null;

    for (const device of await Device.findByCapability('THERMOSTAT')) {
      const thermostat = device.getThermostatCapability();
      const scheduledTemp = await thermostat.getScheduledTemperatureAtTime(etaTime);

      if (scheduledTemp) {
        const targetTemp = etaWindow === null ? scheduledTemp : scheduledTemp + etaWindow.offset;
        const startTime = await calculateWarmupStartTime(device, targetTemp, etaTime);

        if (earliestWarmup === null || startTime?.isBefore(earliestWarmup)) {
          earliestWarmup = startTime;
        }

        warmups.push({
          device,
          start: async () => {
            if (etaWindow !== null) {
              await thermostat.setTargetTemperatureUntil(targetTemp, etaWindow.end);
            } else if (await thermostat.getNextScheduledChange() === null) {
              await thermostat.setIsOn(true);
            } else {
              await thermostat.setTargetTemperatureUntilNextScheduledChange(scheduledTemp);
            }
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

    for (const { start } of warmups) {
      await start();
    }

    await Log.notify({
      severity: 'info',
      devices: warmups.map(({ device }) => device),
      message: 'Pre-heating started.'
    });
  }

  const runCheck = createBackgroundTransaction('automations:heating-warmup', async () => {
    const now = new Date();
    const isSomeoneHome = await Stay.checkIfSomeoneHomeAt(now);
    const nextEta = await Stay.findNextUpcomingEta();

    if (isSomeoneHome) {
      await checkAtHomeWarmup(findOffsetWindowAt(now));
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
