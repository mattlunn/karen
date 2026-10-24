import { z } from 'zod';
import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { BooleanEvent } from '../models';
import dayjs from '../dayjs';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { formatDuration } from '../helpers/date';
import { DeviceCapabilityEvents } from '../models/capabilities';

export const parameters = z.strictObject({}).nullish();

export default function () {
  DeviceCapabilityEvents.onHeatPumpIsSystemPressureLowStart(createBackgroundTransaction('automations:alerts:system-pressure-low', async () => {
    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: '🚨 Heating system pressure is low.'
    });
  }));

  DeviceCapabilityEvents.onHeatPumpIsSystemPressureLowEnd(createBackgroundTransaction('automations:alerts:system-pressure-recovered', async (event: BooleanEvent) => {
    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: `✅ Heating system pressure has recovered, after being low for ${formatDuration(dayjs(event.end).diff(event.start, 'second'))}.`
    });
  }));
}
