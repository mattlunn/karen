import { z } from 'zod';
import { BooleanEvent, Device, Log } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { normalizeTime } from '../helpers/time';
import dayjs from '../dayjs';
import { timeString } from './schema';

const WITHIN_HOURS = /^\+(\d+)h$/;

export const parameters = z.object({
  buttonName: z.string(),
  dishwasherName: z.string(),
  // Keyed by the button's instance id, e.g. `button1`: the next occurrence of a time of day, or
  // "+24h" to finish within that many hours of the press.
  finishTimes: z.record(z.string(), z.union([timeString, z.string().regex(WITHIN_HOURS, 'must be a time of day, or "+<hours>h"')])),
});

function finishByFor(finishTime: string, now: Date): Date {
  const withinHours = finishTime.match(WITHIN_HOURS);

  if (withinHours !== null) {
    return dayjs(now).add(Number(withinHours[1]), 'hour').toDate();
  }

  const today = normalizeTime(finishTime, now);

  return (today.isAfter(now) ? today : normalizeTime(finishTime, dayjs(now).add(1, 'day').toDate())).toDate();
}

export default function ({ buttonName, dishwasherName, finishTimes }: z.infer<typeof parameters>) {
  DeviceCapabilityEvents.onButtonPressed(
    device => device.name === buttonName,
    createBackgroundTransaction('automations:dishwasher', async (event: BooleanEvent) => {
      const finishTime = finishTimes[event.instanceId!];

      if (finishTime === undefined) {
        throw new Error(`${buttonName} ${event.instanceId} has no finish time configured`);
      }

      let device: Device | null = null;

      try {
        device = await Device.findByNameOrError(dishwasherName);

        const run = await device.getDishwasherCapability().scheduleToFinishBy(finishByFor(finishTime, new Date()));

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
