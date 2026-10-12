import { z } from 'zod';
import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { BooleanEvent, Device } from '../models';
import { DeviceCapabilityEvents } from '../models/capabilities';
import { createBackgroundTransaction } from '../helpers/newrelic';
import dayjs from '../dayjs';

export const parameters = z.object({
  buttonName: z.string(),
  dishwasherName: z.string(),
  // Keyed by the button's instance id, e.g. `button1`.
  meals: z.record(z.string(), z.enum(['BREAKFAST', 'LUNCH', 'DINNER'])),
});

export default function ({ buttonName, dishwasherName, meals }: z.infer<typeof parameters>) {
  DeviceCapabilityEvents.onButtonPressed(
    device => device.name === buttonName,
    createBackgroundTransaction('automations:dishwasher-meal-buttons', async (event: BooleanEvent) => {
      const meal = event.instanceId === null ? undefined : meals[event.instanceId];

      if (meal === undefined) {
        return;
      }

      try {
        const dishwasher = await Device.findByNameOrError(dishwasherName);
        const run = await dishwasher.getDishwasherCapability().toggleMealSchedule(meal);

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: run === null
            ? '🍽️ Cancelled the dishwasher\'s scheduled run.'
            : `🍽️ Dishwasher starts at ${dayjs(run.start).format('HH:mm')}, finishing by ${dayjs(run.finishBy).format('HH:mm')}.`
        });
      } catch (err) {
        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `🍽️ Couldn't schedule the dishwasher: ${(err as Error).message}`
        });
      }
    })
  );
}
