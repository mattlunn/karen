import bus, { NOTIFICATION_TO_ALL } from '../bus';
import { Device } from '../models';
import config from '../config';
import dayjs from '../dayjs';
import logger from '../logger';

export default function ({ reminderTime = '19:00' }: { reminderTime?: string }) {
  function scheduleNextReminder() {
    const now = dayjs();
    const [hours, minutes] = reminderTime.split(':').map(Number);
    let next = now.hour(hours).minute(minutes).second(0);

    if (next.isSameOrBefore(now)) {
      next = next.add(1, 'day');
    }

    const delay = next.diff(now);

    setTimeout(async () => {
      try {
        await sendReminders();
      } catch (e) {
        logger.error(e, 'Failed to send bin collection reminders');
      }

      scheduleNextReminder();
    }, delay);

    logger.info(`Bin collection reminder scheduled for ${next.format('YYYY-MM-DD HH:mm')}`);
  }

  async function sendReminders() {
    const devices = await Device.findByProvider('bins');
    const tomorrow = dayjs().add(1, 'day');
    const tomorrowStr = tomorrow.format('YYYY-MM-DD');

    // Check if tomorrow has a top-level override (i.e. tomorrow was moved somewhere else)
    const overrideFromTomorrow = config.bins.overrides.find(o => o.originalDate === tomorrowStr);
    // Check if tomorrow is the target of an override (i.e. something was moved TO tomorrow)
    const overrideToTomorrow = config.bins.overrides.find(o => o.newDate === tomorrowStr);

    // Group bins by what's happening tomorrow
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

      // If tomorrow was supposed to be a collection day but got overridden
      if (overrideFromTomorrow && cap.getOverrideForOriginalDate(tomorrow.toDate())) {
        movedFromTomorrow.push(device.name);
      }
    }

    if (collectTomorrow.length > 0) {
      bus.emit(NOTIFICATION_TO_ALL, {
        message: `🗑️ Put out the ${formatBinList(collectTomorrow)} - collection tomorrow (${tomorrow.format('ddd D MMM')})`,
      });
    }

    if (overrideTomorrow.length > 0) {
      const movedFrom = overrideToTomorrow
        ? `, moved from ${dayjs(overrideToTomorrow.originalDate).format('ddd D MMM')}`
        : '';
      bus.emit(NOTIFICATION_TO_ALL, {
        message: `🗑️ Put out the ${formatBinList(overrideTomorrow)} - collection tomorrow (${tomorrow.format('ddd D MMM')}${movedFrom})`,
      });
    }

    if (movedFromTomorrow.length > 0) {
      const newDate = dayjs(overrideFromTomorrow!.newDate);
      bus.emit(NOTIFICATION_TO_ALL, {
        message: `🗑️ ${formatBinList(movedFromTomorrow)} collection moved to ${newDate.format('ddd D MMM')}`,
      });
    }
  }

  scheduleNextReminder();
}

function formatBinList(names: string[]): string {
  if (names.length === 1) {
    return `${names[0]} bin`;
  }

  if (names.length === 2) {
    return `${names[0]} and ${names[1]} bins`;
  }

  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} bins`;
}
