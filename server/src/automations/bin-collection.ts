import { z } from 'zod';
import { timeString } from './schema';
import { Device, Log } from '../models';
import config from '../config';
import dayjs from '../dayjs';
import logger from '../logger';
import scheduleDaily from '../helpers/schedule-daily';
import { joinWithAnd, pluralise } from '../helpers/array';

export const parameters = z.object({
  reminderTime: timeString
});

export default function ({ reminderTime }: z.infer<typeof parameters>) {
  scheduleDaily(async () => {
    try {
      const devices = await Device.findByCapability('BIN_COLLECTION');
      const tomorrow = dayjs().add(1, 'day');
      const tomorrowStr = tomorrow.format('YYYY-MM-DD');

      const overrideFromTomorrow = config.bins.overrides.find(o => o.originalDate === tomorrowStr);
      const overrideToTomorrow = config.bins.overrides.find(o => o.newDate === tomorrowStr);

      const collectTomorrow: Device[] = [];
      const movedFromTomorrow: Device[] = [];
      const overrideTomorrow: Device[] = [];
      const names = (bins: Device[]) => joinWithAnd(bins.map(bin => bin.name));

      for (const device of devices) {
        const cap = device.getBinCollectionCapability();
        const next = cap.getNextCollectionDate();

        if (dayjs(next.date).isSame(tomorrow, 'day')) {
          if (next.isOverride) {
            overrideTomorrow.push(device);
          } else {
            collectTomorrow.push(device);
          }
        }

        if (overrideFromTomorrow && cap.getOverrideForOriginalDate(tomorrow.toDate())) {
          movedFromTomorrow.push(device);
        }
      }

      if (collectTomorrow.length > 0) {
        await Log.notify({
          severity: 'notice',
          audience: 'all',
          devices: collectTomorrow,
          message: `🗑️ Put out the ${names(collectTomorrow)} bin${pluralise(collectTomorrow)} - collection tomorrow (${tomorrow.format('ddd D MMM')})`,
        });
      }

      if (overrideTomorrow.length > 0) {
        const movedFrom = overrideToTomorrow
          ? `, moved from ${dayjs(overrideToTomorrow.originalDate).format('ddd D MMM')}`
          : '';
        await Log.notify({
          severity: 'notice',
          audience: 'all',
          devices: overrideTomorrow,
          message: `🗑️ Put out the ${names(overrideTomorrow)} bin${pluralise(overrideTomorrow)} - collection tomorrow (${tomorrow.format('ddd D MMM')}${movedFrom})`,
        });
      }

      if (movedFromTomorrow.length > 0) {
        const newDate = dayjs(overrideFromTomorrow!.newDate);
        await Log.notify({
          severity: 'notice',
          audience: 'all',
          devices: movedFromTomorrow,
          message: `🗑️ ${names(movedFromTomorrow)} bin collection moved to ${newDate.format('ddd D MMM')}`,
        });
      }
    } catch (e) {
      logger.error(e, 'Failed to send bin collection reminders');
    }
  }, reminderTime);
}
