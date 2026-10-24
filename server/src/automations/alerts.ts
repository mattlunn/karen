import { z } from 'zod';
import bus, { NOTIFICATION_TO_ADMINS } from '../bus';
import { Device } from '../models';
import dayjs from '../dayjs';
import setCron from '../helpers/set-cron';
import { createBackgroundTransaction } from '../helpers/newrelic';
import { timeWeightedAverage } from '../helpers/time-weighted-average';
import { formatDuration } from '../helpers/date';

export const parameters = z.strictObject({
  systemPressure: z.strictObject({
    checkCron: z.string(),
    averageMinutes: z.number().positive(),
    lowBar: z.number().positive(),
    recoveredBar: z.number().positive()
  }).refine(({ lowBar, recoveredBar }) => recoveredBar > lowBar, {
    message: 'recoveredBar must be above lowBar'
  })
});

export default function ({ systemPressure }: z.infer<typeof parameters>) {
  const { checkCron, averageMinutes, lowBar, recoveredBar } = systemPressure;
  const lowSinceByDeviceId = new Map<number, Date>();

  setCron(createBackgroundTransaction('automations:alerts:system-pressure', async () => {
    const until = new Date();
    const since = dayjs(until).subtract(averageMinutes, 'minute').toDate();

    for (const device of await Device.findByCapability('HEAT_PUMP')) {
      const history = await device.getHeatPumpCapability().getSystemPressureHistory({ since, until });
      const average = timeWeightedAverage(history, since, until);

      if (average === null) {
        continue;
      }

      const lowSince = lowSinceByDeviceId.get(device.id);

      if (!lowSince && average < lowBar) {
        lowSinceByDeviceId.set(device.id, until);

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `🚨 Heating system pressure is low, averaging ${average.toFixed(2)} bar over the last ${averageMinutes} minutes (below ${lowBar} bar).`
        });
      } else if (lowSince && average >= recoveredBar) {
        lowSinceByDeviceId.delete(device.id);

        bus.emit(NOTIFICATION_TO_ADMINS, {
          message: `✅ Heating system pressure has recovered, averaging ${average.toFixed(2)} bar over the last ${averageMinutes} minutes, after being low for ${formatDuration(dayjs(until).diff(lowSince, 'second'))}.`
        });
      }
    }
  }), checkCron);
}
