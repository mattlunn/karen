import { z } from 'zod';
import bus, { FIRST_USER_HOME, LAST_USER_LEAVES, STAY_START, STAY_END } from '../bus';
import { Device, Log, Stay } from '../models';
import dayjs, { Dayjs } from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import logger from '../logger';
import nowAndSetCron from '../helpers/now-and-set-cron';
import { isWithinTime, findTimeWindowContaining } from '../helpers/time';
import { timeRange } from './schema';

export const parameters = z.object({
  checkCron: z.string(),
  minWarmUpRatePerHour: z.number().positive(),
  dhwAutoLeadTimeHours: z.number().positive(),
  targetOffsetWindows: z.array(timeRange.extend({ offset: z.number() }))
});

type WarmupState = Date | null;
type OffsetWindow = z.infer<typeof parameters>['targetOffsetWindows'][number];

let currentWarmupState: WarmupState = null;

// When the occurrence of `window` that `time` falls in ends; for a window
// crossing midnight, that can be the day after the one `end` reads against.
function endOfOffsetWindowAt(window: OffsetWindow, time: Date): Date {
  return findTimeWindowContaining(window.start, window.end, time)!.end;
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
    return targetOffsetWindows.find(w => isWithinTime(w.start, w.end, time)) ?? null;
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

  async function checkAtHomeWarmup(): Promise<void> {
    const thermostatDevices = await Device.findByCapability('THERMOSTAT');
    const now = new Date();
    const window = findOffsetWindowAt(now);

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
          continue;
        }
      }

      if (window === null) {
        continue;
      }

      const scheduled = await thermostat.getScheduledTemperatureAtTime(now);

      // Off, set by hand, or already under an override (this window's offset
      // included) that stands until it lapses.
      if (scheduled === null || targetTemperature !== scheduled) {
        continue;
      }

      const target = scheduled + window.offset;
      const until = endOfOffsetWindowAt(window, now);

      await thermostat.setTargetTemperatureUntil(target, until);
      logger.info(`Heating: ${device.name} target ${target}°C (${scheduled}°C ${window.offset >= 0 ? '+' : ''}${window.offset}) until ${until.toISOString()}`);
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
              await thermostat.setTargetTemperatureUntil(targetTemp, endOfOffsetWindowAt(etaWindow, etaTime));
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
