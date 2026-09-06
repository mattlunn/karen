import dayjs from '../../../../dayjs';
import { PriceSlot } from '../../../../helpers/prices';

export interface SparklinePoint {
  x: number;
  y: number;
}

export interface SparklineData {
  // Empty when no slots fall within the window - nothing to draw.
  points: SparklinePoint[];
  // Pixel y of the 0-pence line, or null when the window never crosses zero.
  zeroY: number | null;
}

/**
 * Scales the price series within [now, now + windowHours) to pixel points
 * for a sparkline of the given size. Min-max scaled to the window's own
 * range rather than a fixed pence axis - a sparkline is about shape, not
 * absolute numbers. The first point is always at x = 0, since the window
 * starts at `now`.
 */
export function scaleSparkline(slots: PriceSlot[], now: Date, windowHours: number, width: number, height: number): SparklineData {
  const windowEnd = dayjs(now).add(windowHours, 'hour').toDate();
  const inWindow = slots.filter(s => s.start >= now && s.start < windowEnd);

  if (inWindow.length === 0) {
    return { points: [], zeroY: null };
  }

  const pences = inWindow.map(s => s.pence);
  const min = Math.min(...pences);
  const max = Math.max(...pences);
  const spanMs = windowHours * 60 * 60 * 1000;

  const scaleY = (pence: number) => (max === min ? height / 2 : height - ((pence - min) / (max - min)) * height);

  return {
    points: inWindow.map(s => ({ x: ((s.start.getTime() - now.getTime()) / spanMs) * width, y: scaleY(s.pence) })),
    zeroY: min < 0 && max > 0 ? scaleY(0) : null,
  };
}
