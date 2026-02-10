import dayjs from '../../dayjs';
import { NumericEvent } from '../../models/event';
import { ElectricVehicleCapability } from '../../models/capabilities';
import { clampAndSortHistory } from '../../helpers/history';
import { Device } from '../../models';
import logger from '../../logger';

/**
 * Calculate weekly mileage from odometer readings
 */
export async function calculateWeeklyMileage(
  capability: ElectricVehicleCapability,
  startOfWeek: Date,
  endOfWeek: Date
): Promise<number> {
  const odometerHistory = await capability.getOdometerHistory({
    since: startOfWeek,
    until: endOfWeek
  });

  const clamped = clampAndSortHistory(odometerHistory, startOfWeek, endOfWeek, false);

  if (clamped.length === 0) {
    return 0;
  }

  // Get the first and last odometer readings
  const startOdometer = clamped[0].value;
  const endOdometer = clamped[clamped.length - 1].value;

  return Math.max(0, endOdometer - startOdometer);
}

/**
 * Store weekly mileage for a given week
 */
export async function storeWeeklyMileage(
  capability: ElectricVehicleCapability,
  startOfWeek: Date,
  endOfWeek: Date
): Promise<void> {
  const mileage = await calculateWeeklyMileage(capability, startOfWeek, endOfWeek);

  await capability.setWeeklyMileageState(mileage, startOfWeek);

  logger.info(`Weekly mileage for ${dayjs(startOfWeek).format('YYYY-MM-DD')}: ${mileage.toFixed(1)} mi`);
}

/**
 * Ensure all historical weekly mileage exists
 * Called every 15 minutes to fill in any missing weeks
 */
export async function ensureHistoricalMileage(
  device: Device,
  capability: ElectricVehicleCapability
): Promise<void> {
  const latestEvent = await capability.getWeeklyMileageEvent();

  const endDate = dayjs().startOf('week'); // Start of current week (Monday)
  const startDate = latestEvent === null
    ? dayjs(device.createdAt).startOf('week')
    : dayjs(latestEvent.lastReported).startOf('week').add(1, 'week');

  // Fill in missing weeks
  for (let week = startDate; week.isBefore(endDate); week = week.add(1, 'week')) {
    const weekStart = week.toDate();
    const weekEnd = week.add(1, 'week').toDate();

    logger.info(`Calculating weekly mileage for ${week.format('YYYY-MM-DD')}`);
    await storeWeeklyMileage(capability, weekStart, weekEnd);
  }
}

/**
 * Calculate and store current week's running mileage
 */
export async function storeCurrentWeekRunningMileage(
  capability: ElectricVehicleCapability
): Promise<void> {
  const startOfWeek = dayjs().startOf('week').toDate();
  const now = new Date();

  await storeWeeklyMileage(capability, startOfWeek, now);
}
