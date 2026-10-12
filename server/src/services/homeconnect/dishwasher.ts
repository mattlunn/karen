import { Device } from '../../models';
import { DishwasherScheduledRun } from '../../models/capabilities';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
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
  const run = planRun(await getForwardSlots(finishBy), remainingSeconds / 60, finishBy, now);

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

// Moves a pending run once Octopus publishes prices further than when it was planned, since the
// part of the plan beyond the old frontier was based on a forecast.
export async function replanScheduledRun(client: ApiClient, device: Device): Promise<void> {
  const run = getPendingRun(device);

  if (run === null) {
    return;
  }

  const now = new Date();
  const finishBy = new Date(run.finishBy);
  const slots = await getForwardSlots(finishBy);
  const publishedEnd = slots.findLast((slot) => !slot.isEstimated)?.end;

  if (publishedEnd === undefined || (run.publishedEnd !== null && !dayjs(publishedEnd).isAfter(run.publishedEnd))) {
    return;
  }

  const replanned = planRun(slots, run.durationMinutes, finishBy, now);

  if (replanned.start === run.start) {
    await setPendingRun(device, replanned);
    return;
  }

  try {
    await client.setActiveProgramOption(device.providerId, startInRelative(replanned.start, now));
  } catch (err) {
    logger.error(err, 'Dishwasher: failed to move the scheduled start');

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `🍽️ Couldn't move the dishwasher's start to ${dayjs(replanned.start).format('HH:mm')}: ${(err as Error).message}. It was due to start at ${dayjs(run.start).format('HH:mm')}.`
    });

    await setPendingRun(device, { ...run, publishedEnd: replanned.publishedEnd });
    return;
  }

  await setPendingRun(device, replanned);

  bus.emit(NOTIFICATION_TO_ADMINS, {
    message: `🍽️ Now that prices are published, the dishwasher starts at ${dayjs(replanned.start).format('HH:mm')} instead of ${dayjs(run.start).format('HH:mm')}, finishing by ${dayjs(replanned.finishBy).format('HH:mm')}.`
  });
}
