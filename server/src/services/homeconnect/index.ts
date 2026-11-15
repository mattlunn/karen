import { Device } from '../../models';
import config from '../../config';
import { DishwasherScheduledRun } from '../../models/capabilities';
import dayjs from '../../dayjs';
import logger from '../../logger';
import { PriceSlot, SLOT_MINUTES } from '../../helpers/prices';
import ApiClient, { ProgramOption } from './lib/client';
import { getAccessToken } from './lib/auth';
import { planRun, StoredRun } from './plan';

const START_IN_RELATIVE = 'BSH.Common.Option.StartInRelative';
const REMAINING_PROGRAM_TIME = 'BSH.Common.Option.RemainingProgramTime';
const DISHWASHER_OPTION_PREFIX = 'Dishcare.Dishwasher.Option.';
const OPERATION_STATE_RUN = 'BSH.Common.EnumType.OperationState.Run';
const OPERATION_STATE_DELAYED_START = 'BSH.Common.EnumType.OperationState.DelayedStart';

const client = new ApiClient(getAccessToken);

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

async function getForwardSlots(until: Date): Promise<PriceSlot[]> {
  const [energyCostDevice] = await Device.findByCapability('ENERGY_COST');

  if (energyCostDevice === undefined) {
    throw new Error('There is no energy cost device to plan the dishwasher run against');
  }

  return energyCostDevice.getEnergyCostCapability().getForwardUnitRates(until);
}

// Asks the appliance, not the stored run (which goes stale if the panel is used), because stopping
// the active program mid-cycle would end a clean in progress.
async function cancelDelayedStart(device: Device): Promise<void> {
  const state = await client.getOperationState(device.providerId);

  await setPendingRun(device, undefined);

  if (state === OPERATION_STATE_RUN) {
    throw new Error('The dishwasher is already running');
  }

  if (state === OPERATION_STATE_DELAYED_START) {
    await client.stopActiveProgram(device.providerId);
  }
}

function startInRelative(start: string, now: Date): ProgramOption {
  return { key: START_IN_RELATIVE, value: Math.max(0, dayjs(start).diff(now, 'second')), unit: 'seconds' };
}

Device.registerProvider('homeconnect', {
  getCapabilities(device) {
    return device.model === 'Dishwasher' ? ['DISHWASHER'] : [];
  },

  provideDishwasherCapability() {
    return {
      getScheduledRun(device: Device) {
        const run = getPendingRun(device);

        return run === null ? null : toScheduledRun(run);
      },

      async scheduleToFinishBy(device: Device, finishBy: Date) {
        await cancelDelayedStart(device);

        const program = await client.getSelectedProgram(device.providerId);
        const remainingSeconds = program.options.find((option) => option.key === REMAINING_PROGRAM_TIME)?.value;

        if (typeof remainingSeconds !== 'number') {
          throw new Error('The dishwasher didn\'t report how long its selected program takes');
        }

        const now = new Date();
        const durationMinutes = remainingSeconds / 60;
        const slots = await getForwardSlots(dayjs(finishBy).add(durationMinutes + SLOT_MINUTES, 'minute').toDate());
        const run = planRun(slots, durationMinutes, config.homeconnect.dishwasher_power_profile_kwh, finishBy, now);

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
      },

      async cancelScheduledRun(device: Device) {
        if (getPendingRun(device) === null) {
          return;
        }

        await cancelDelayedStart(device);
      },
    };
  },

  async synchronize() {
    for (const appliance of await client.getAppliances()) {
      if (appliance.type !== 'Dishwasher') {
        continue;
      }

      let device = await Device.findByProviderId('homeconnect', appliance.haId);

      if (device === null) {
        device = Device.build({ provider: 'homeconnect', providerId: appliance.haId, name: appliance.name });
      }

      device.manufacturer = 'Home Connect';
      device.model = appliance.type;

      await device.save();
    }
  }
});
