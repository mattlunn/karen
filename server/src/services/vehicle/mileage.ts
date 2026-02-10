import dayjs from '../../dayjs';
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
export async function storeWeeklyMileage(capability: ElectricVehicleCapability, startOfWeek: Date, endOfWeek: Date): Promise<void> {
  const mileage = await calculateWeeklyMileage(capability, startOfWeek, endOfWeek);

  await capability.setWeeklyMileageState(mileage, startOfWeek);

  logger.info(`Weekly mileage for ${dayjs(startOfWeek).format('YYYY-MM-DD')}: ${mileage.toFixed(1)} mi`);
}

export async function ensureHistoricalMileage(device: Device, capability: ElectricVehicleCapability): Promise<void> {
  const latestEvent = await capability.getWeeklyMileageEvent();
  const endDate = dayjs().startOf('week'); 
  const startDate = latestEvent === null
    ? dayjs(device.createdAt).startOf('week')
    : dayjs(latestEvent.lastReported).startOf('week').add(1, 'week');

  for (let week = startDate; week.isBefore(endDate); week = week.add(1, 'week')) {
    const weekStart = week.toDate();
    const weekEnd = week.add(1, 'week').toDate();

    logger.info(`Calculating weekly mileage for ${week.format('YYYY-MM-DD')}`);
    await storeWeeklyMileage(capability, weekStart, weekEnd);
  }
}
