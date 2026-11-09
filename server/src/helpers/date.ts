import dayjs, { Dayjs } from '../dayjs';

export function humanDate(date: Dayjs): string {
  const now = dayjs();

  if (date.isSame(now, 'day')) {
    return 'today';
  } else if (date.isSame(dayjs(now).subtract(1, 'day'), 'day')) {
    return 'yesterday';
  } else if (date.isSame(dayjs(now).add(1, 'day'), 'day')) {
    return 'tomorrow';
  } else {
    return 'on ' + (
      date.isSame(now, 'month')
        ? date.format('ddd Do')
        : date.format('ddd Do MMM')
    );
  }
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    const rounded = Math.max(1, Math.round(seconds));
    return `${rounded} second${rounded === 1 ? '' : 's'}`;
  }

  const totalMinutes = Math.round(seconds / 60);

  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? '' : 's'}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hoursPart = `${hours} hour${hours === 1 ? '' : 's'}`;

  if (minutes === 0) {
    return hoursPart;
  }

  return `${hoursPart} ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

export function isWithinWindow(window: { start: Date, end: Date }, date: Date): boolean {
  return date >= window.start && date < window.end;
}

// Times of day ("HH:mm"), repeating daily; `to` may be "24:00".
export interface DailyWindow {
  from: string;
  to: string;
}

// That time of day on `date`'s day; "24:00" is the following midnight.
export function timeOfDayOn(timeOfDay: string, date: Date): Date {
  const [hours, minutes] = timeOfDay.split(':').map(Number);

  if (hours === 24) {
    return dayjs(date).add(1, 'day').startOf('day').toDate();
  }

  return dayjs(date).hour(hours).minute(minutes).second(0).millisecond(0).toDate();
}

export function isInDailyWindow(window: DailyWindow, date: Date): boolean {
  return date >= timeOfDayOn(window.from, date) && date < timeOfDayOn(window.to, date);
}

export function fitsInDailyWindow(window: DailyWindow, start: Date, end: Date): boolean {
  return isInDailyWindow(window, start) && end <= timeOfDayOn(window.to, start);
}
