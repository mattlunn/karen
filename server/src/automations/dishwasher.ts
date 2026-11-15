import { z } from 'zod';
import { BooleanEvent, Device, Log } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { normalizeTime } from '../helpers/time';
import dayjs from '../dayjs';
import { timeString } from './schema';

export const parameters = z.object({
  buttonName: z.string(),
  dishwasherName: z.string(),
  // Keyed by the button's instance id, e.g. `button1`.
  finishTimes: z.record(z.string(), timeString),
});

function nextOccurrence(time: string, now: Date): Date {
  const today = normalizeTime(time, now);

  return (today.isAfter(now) ? today : normalizeTime(time, dayjs(now).add(1, 'day').toDate())).toDate();
}

export default function ({ buttonName, dishwasherName, finishTimes }: z.infer<typeof parameters>) {
  DeviceCapabilityEvents.onButtonPressed(
    device => device.name === buttonName,
    createBackgroundTransaction('automations:dishwasher', async (event: BooleanEvent) => {
      const time = event.instanceId === null ? undefined : finishTimes[event.instanceId];

      if (time === undefined) {
        return;
      }

      let device: Device | null = null;

      try {
        device = await Device.findByNameOrError(dishwasherName);

        const dishwasher = device.getDishwasherCapability();
        const scheduled = dishwasher.getScheduledRun();

        // Pressing the button for the run that's already scheduled cancels it.
        if (scheduled !== null && dayjs(scheduled.finishBy).isSame(normalizeTime(time, scheduled.finishBy))) {
          await dishwasher.cancelScheduledRun();

          await Log.notify({ severity: 'notice', devices: [device], message: '🍽️ Cancelled the dishwasher\'s scheduled run.' });
          return;
        }

        const run = await dishwasher.scheduleToFinishBy(nextOccurrence(time, new Date()));

        await Log.notify({
          severity: 'notice',
          devices: [device],
          message: `🍽️ Dishwasher starts at ${dayjs(run.start).format('HH:mm')}, done at ${dayjs(run.end).format('HH:mm')}.`
        });
      } catch (err) {
        await Log.notify({
          severity: 'warning',
          devices: device === null ? [] : [device],
          message: `🍽️ Couldn't schedule the dishwasher: ${(err as Error).message}`
        });
      }
    })
  );
}
