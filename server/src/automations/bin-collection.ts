import bus, { NOTIFICATION_TO_ALL } from '../bus';
import { Device } from '../models';
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

    // Group bins by what's happening tomorrow
    const collectTomorrow: string[] = [];
    const movedFromTomorrow: Array<{ name: string; newDate: string }> = [];
    const overrideTomorrow: Array<{ name: string; originalDate: string }> = [];

    for (const device of devices) {
      const cap = device.getBinCollectionCapability();
      const next = cap.getNextCollectionDate();

      // Check if tomorrow is a regular or override collection day
      if (next && dayjs(next.date).isSame(tomorrow, 'day')) {
        if (next.isOverride) {
          const originalDate = cap.getOriginalDateForOverride(next.date);
          overrideTomorrow.push({ name: device.name, originalDate: originalDate ?? '' });
        } else {
          collectTomorrow.push(device.name);
        }
      }

      // Check if tomorrow was supposed to be a collection day but was overridden
      const overrideNewDate = cap.getOverrideForOriginalDate(tomorrow.toDate());

      if (overrideNewDate) {
        movedFromTomorrow.push({ name: device.name, newDate: overrideNewDate });
      }
    }

    // Send grouped notifications
    if (collectTomorrow.length > 0) {
      const binList = formatBinList(collectTomorrow);
      bus.emit(NOTIFICATION_TO_ALL, {
        message: `🗑️ Put out the ${binList} - collection tomorrow (${tomorrow.format('ddd D MMM')})`,
      });
    }

    if (overrideTomorrow.length > 0) {
      const binList = formatBinList(overrideTomorrow.map(b => b.name));
      const movedFrom = overrideTomorrow[0].originalDate
        ? `, moved from ${dayjs(overrideTomorrow[0].originalDate).format('ddd D MMM')}`
        : '';
      bus.emit(NOTIFICATION_TO_ALL, {
        message: `🗑️ Put out the ${binList} - collection tomorrow (${tomorrow.format('ddd D MMM')}${movedFrom})`,
      });
    }

    if (movedFromTomorrow.length > 0) {
      const binList = formatBinList(movedFromTomorrow.map(b => b.name));
      const newDate = dayjs(movedFromTomorrow[0].newDate);
      bus.emit(NOTIFICATION_TO_ALL, {
        message: `🗑️ ${binList} collection moved to ${newDate.format('ddd D MMM')}`,
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
