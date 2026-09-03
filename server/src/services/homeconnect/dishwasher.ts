import { Device } from '../../models';
import { DishwasherScheduledRun } from '../../models/capabilities';
import config from '../../config/app';
import dayjs from '../../dayjs';
import logger from '../../logger';
import { toPriceSlots, findCheapestWindow, CheapestWindow } from '../../helpers/prices';
import ApiClient, { ProgramOption } from './lib/client';
import { formatProgramName } from './lib/format';

type UnitRateEvent = { start: Date; end: Date | null; value: number };

const START_IN_RELATIVE = 'BSH.Common.Option.StartInRelative';
const REMAINING_PROGRAM_TIME = 'BSH.Common.Option.RemainingProgramTime';
const DISHWASHER_OPTION_PREFIX = 'Dishcare.Dishwasher.Option.';

// A run is only "scheduled" until its start; from then on the appliance is
// running it and ProgramName / EstimatedCompletionTime describe what's happening.
export function getScheduledRun(device: Device): DishwasherScheduledRun | null {
  const stored = device.meta.dishwasherRun as DishwasherScheduledRun | undefined;

  if (stored === undefined || new Date(stored.start) <= new Date()) {
    return null;
  }

  return stored;
}

export async function clearScheduledRun(device: Device): Promise<void> {
  if (device.meta.dishwasherRun !== undefined) {
    device.meta.dishwasherRun = undefined;

    await device.save();
  }
}

/**
 * Planning is user-initiated, so unlike the unattended DHW and EV loops there's
 * no `haveForecastThrough` gate: plan within whatever Agile has published rather
 * than refuse when the horizon isn't fully priced yet. `findCheapestWindow`
 * returns null when no published run is long enough.
 */
export function pickRunWindow(events: UnitRateEvent[], now: Date, until: Date, runMinutes: number): CheapestWindow | null {
  return findCheapestWindow(toPriceSlots(events, now, until), runMinutes, now, until);
}

// Only some appliances report the selected program's duration, so fall back to a
// configured typical cycle length.
function runMinutesOf(options: ProgramOption[]): number {
  const remaining = options.find(option => option.key === REMAINING_PROGRAM_TIME);

  return typeof remaining?.value === 'number'
    ? remaining.value / 60
    : config.homeconnect.dishwasher_default_run_minutes;
}

async function getForwardUnitRates(since: Date, until: Date): Promise<UnitRateEvent[]> {
  const devices = await Device.findByCapability('ENERGY_COST');

  if (devices.length === 0) {
    throw new Error('No energy cost device, so the cheapest run window cannot be found');
  }

  return devices[0].getEnergyCostCapability().getUnitRateHistory({ since, until });
}

export default function createScheduler(client: ApiClient) {
  return {
    getScheduledRun,

    async scheduleCheapestRun(device: Device): Promise<void> {
      const selected = await client.getSelectedProgram(device.providerId);
      const horizonHours = config.homeconnect.dishwasher_planning_horizon_hours;
      const now = new Date();
      const until = dayjs(now).add(horizonHours, 'hour').toDate();
      const runMinutes = runMinutesOf(selected.options);
      const window = pickRunWindow(await getForwardUnitRates(now, until), now, until, runMinutes);

      if (window === null) {
        throw new Error(`No ${runMinutes} minute run fits within the next ${horizonHours} hours of published prices`);
      }

      const programName = formatProgramName(selected.key);

      // The appliance owns the countdown, so the run survives a Karen restart.
      await client.startActiveProgram(device.providerId, selected.key, [
        ...selected.options.filter(option => option.key.startsWith(DISHWASHER_OPTION_PREFIX)),
        { key: START_IN_RELATIVE, value: dayjs(window.start).diff(now, 'second'), unit: 'seconds' },
      ]);

      device.meta.dishwasherRun = {
        start: window.start.toISOString(),
        end: window.end.toISOString(),
        programName,
      } satisfies DishwasherScheduledRun;

      await device.save();
      logger.info(`Dishwasher: scheduled ${programName} for ${window.start.toISOString()} - ${window.end.toISOString()} @ ${window.averagePence.toFixed(2)}p/kWh`);
    },

    async cancelScheduledRun(device: Device): Promise<void> {
      await client.stopActiveProgram(device.providerId);
      await clearScheduledRun(device);
    }
  };
}
