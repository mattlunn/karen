import bus, { NOTIFICATION_TO_ALL } from '../bus';
import { Device } from '../models';
import config from '../config';
import dayjs from '../dayjs';
import logger from '../logger';
import setIntervalForTime from '../helpers/set-interval-for-time';
import { joinWithAnd, pluralise } from '../helpers/array';

type BinCollectionAutomationParameters = {
  reminderTime: string;
};

export default function ({ reminderTime }: BinCollectionAutomationParameters) {
  setIntervalForTime(async () => {
    try {
      const devices = await Device.findByCapability('BIN_COLLECTION');
      const tomorrow = dayjs().add(1, 'day');
      const tomorrowStr = tomorrow.format('YYYY-MM-DD');

      const overrideFromTomorrow = config.bins.overrides.find(o => o.originalDate === tomorrowStr);
      const overrideToTomorrow = config.bins.overrides.find(o => o.newDate === tomorrowStr);

      const collectTomorrow: string[] = [];
      const movedFromTomorrow: string[] = [];
      const overrideTomorrow: string[] = [];

      for (const device of devices) {
        const cap = device.getBinCollectionCapability();
        const next = cap.getNextCollectionDate();

        if (dayjs(next.date).isSame(tomorrow, 'day')) {
          if (next.isOverride) {
            overrideTomorrow.push(device.name);
          } else {
            collectTomorrow.push(device.name);
          }
        }

        if (overrideFromTomorrow && cap.getOverrideForOriginalDate(tomorrow.toDate())) {
          movedFromTomorrow.push(device.name);
        }
      }

      if (collectTomorrow.length > 0) {
        bus.emit(NOTIFICATION_TO_ALL, {
          message: `🗑️ Put out the ${joinWithAnd(collectTomorrow)} bin${pluralise(collectTomorrow)} - collection tomorrow (${tomorrow.format('ddd D MMM')})`,
        });
      }

      if (overrideTomorrow.length > 0) {
        const movedFrom = overrideToTomorrow
          ? `, moved from ${dayjs(overrideToTomorrow.originalDate).format('ddd D MMM')}`
          : '';
        bus.emit(NOTIFICATION_TO_ALL, {
          message: `🗑️ Put out the ${joinWithAnd(overrideTomorrow)} bin${pluralise(overrideTomorrow)} - collection tomorrow (${tomorrow.format('ddd D MMM')}${movedFrom})`,
        });
      }

      if (movedFromTomorrow.length > 0) {
        const newDate = dayjs(overrideFromTomorrow!.newDate);
        bus.emit(NOTIFICATION_TO_ALL, {
          message: `🗑️ ${joinWithAnd(movedFromTomorrow)} bin collection moved to ${newDate.format('ddd D MMM')}`,
        });
      }
    } catch (e) {
      logger.error(e, 'Failed to send bin collection reminders');
    }
  }, reminderTime);
}
