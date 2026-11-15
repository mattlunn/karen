import { Device } from '../../models';
import config from '../../config';
import { DishwasherScheduledRun } from '../../models/capabilities';
import dayjs from '../../dayjs';
import logger from '../../logger';
import { findCheapestWindow, startOfSlot, PriceSlot, SLOT_MINUTES } from '../../helpers/prices';
import ApiClient, { ProgramOption } from './lib/client';
import { getAccessToken } from './lib/auth';

const START_IN_RELATIVE = 'BSH.Common.Option.StartInRelative';
const ECO_50 = 'Dishcare.Dishwasher.Program.Eco50';
const OPERATION_STATE_READY = 'BSH.Common.EnumType.OperationState.Ready';
const OPERATION_STATE_DELAYED_START = 'BSH.Common.EnumType.OperationState.DelayedStart';

type StoredRun = {
  start: string;
  end: string;
  finishBy: string;
};

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
        if (await client.getOperationState(device.providerId) !== OPERATION_STATE_READY) {
          throw new Error('The dishwasher already has a program queued or running');
        }

        const now = new Date();
        const durationMinutes = config.homeconnect.dishwasher_run_minutes;
        const powerProfileKwh = config.homeconnect.dishwasher_power_profile_kwh;
        const windowMinutes = Math.ceil(durationMinutes / SLOT_MINUTES) * SLOT_MINUTES;
        // A run finishing by the deadline can still end part-way through its last slot, which is priced whole.
        const slots = await getForwardSlots(dayjs(finishBy).add(SLOT_MINUTES, 'minute').toDate());
        const window = findCheapestWindow(slots, durationMinutes, startOfSlot(now), dayjs(finishBy).subtract(durationMinutes, 'minute').add(windowMinutes, 'minute').toDate(), powerProfileKwh);
        // The slot already under way means starting now, which is also the fallback when nothing can finish in time.
        const start = window === null || window.start < now ? now : window.start;
        const run: StoredRun = {
          start: start.toISOString(),
          end: dayjs(start).add(durationMinutes, 'minute').toISOString(),
          finishBy: finishBy.toISOString(),
        };

        await client.startProgram(device.providerId, { key: ECO_50, options: [startInRelative(run.start, now)] });

        await setPendingRun(device, run);

        logger.info(`Dishwasher: scheduled Eco 50 for ${run.start} - ${run.end}, to finish by ${run.finishBy}`);

        return toScheduledRun(run);
      },

      async cancelScheduledRun(device: Device) {
        if (getPendingRun(device) === null) {
          return;
        }

        // The stored run goes stale if the panel is used, and stopping the active program mid-cycle
        // would end a clean in progress.
        if (await client.getOperationState(device.providerId) === OPERATION_STATE_DELAYED_START) {
          await client.stopActiveProgram(device.providerId);
        }

        await setPendingRun(device, undefined);
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
