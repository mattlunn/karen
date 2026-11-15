import { Device } from '../../models';
import config from '../../config';
import { DishwasherScheduledRun } from '../../models/capabilities';
import dayjs from '../../dayjs';
import logger from '../../logger';
import { PriceSlot } from '../../helpers/prices';
import ApiClient, { ProgramOption } from './lib/client';
import { planRun, StoredRun } from './plan';

const START_IN_RELATIVE = 'BSH.Common.Option.StartInRelative';
const REMAINING_PROGRAM_TIME = 'BSH.Common.Option.RemainingProgramTime';
const DISHWASHER_OPTION_PREFIX = 'Dishcare.Dishwasher.Option.';

// A run is only scheduled until it starts; after that the appliance is just running it.
function getPendingRun(device: Device): StoredRun | null {
  const run = device.meta.scheduledRun as StoredRun | undefined;

  return run !== undefined && dayjs(run.start).isAfter(new Date()) ? run : null;
}

async function setPendingRun(device: Device, run: StoredRun | undefined): Promise<void> {
  device.meta.scheduledRun = run;

  await device.save();
}

function toScheduledRun(run: StoredRun): DishwasherScheduledRun {
  return {
    start: new Date(run.start),
    end: new Date(run.end),
    finishBy: new Date(run.finishBy),
  };
}

export function getScheduledRun(device: Device): DishwasherScheduledRun | null {
  const run = getPendingRun(device);

  return run === null ? null : toScheduledRun(run);
}

async function getForwardSlots(until: Date): Promise<PriceSlot[]> {
  const [energyCostDevice] = await Device.findByCapability('ENERGY_COST');

  if (energyCostDevice === undefined) {
    throw new Error('There is no energy cost device to plan the dishwasher run against');
  }

  return energyCostDevice.getEnergyCostCapability().getForwardUnitRates(until);
}

function startInRelative(start: string, now: Date): ProgramOption {
  return { key: START_IN_RELATIVE, value: Math.max(0, dayjs(start).diff(now, 'second')), unit: 'seconds' };
}

export async function scheduleToFinishBy(client: ApiClient, device: Device, finishBy: Date): Promise<DishwasherScheduledRun> {
  if (getPendingRun(device) !== null) {
    await client.stopActiveProgram(device.providerId);
    await setPendingRun(device, undefined);
  }

  const program = await client.getSelectedProgram(device.providerId);
  const remainingSeconds = program.options.find((option) => option.key === REMAINING_PROGRAM_TIME)?.value;

  if (typeof remainingSeconds !== 'number') {
    throw new Error('The dishwasher didn\'t report how long its selected program takes');
  }

  const now = new Date();
  const run = planRun(await getForwardSlots(finishBy), remainingSeconds / 60, config.homeconnect.dishwasher_power_profile_kwh, finishBy, now);

  await client.startProgram(device.providerId, {
    key: program.key,
    options: [
      ...program.options.filter((option) => option.key.startsWith(DISHWASHER_OPTION_PREFIX)),
      startInRelative(run.start, now),
    ],
  });

  await setPendingRun(device, run);

  logger.info(`Dishwasher: scheduled ${program.key} for ${run.start} - ${run.end}, to finish by ${run.finishBy}`);

  return toScheduledRun(run);
}

export async function cancelScheduledRun(client: ApiClient, device: Device): Promise<void> {
  if (getPendingRun(device) === null) {
    return;
  }

  await client.stopActiveProgram(device.providerId);
  await setPendingRun(device, undefined);
}
