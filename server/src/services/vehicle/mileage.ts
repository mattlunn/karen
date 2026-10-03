import dayjs from '../../dayjs';
import config from '../../config';
import { ElectricVehicleCapability } from '../../models/capabilities';
import { filterClampAndSortHistory } from '../../helpers/history';
import { Device } from '../../models';
import logger from '../../logger';

/**
 * Calculate monthly mileage from odometer readings
 */
export async function calculateMonthlyMileage(
  capability: ElectricVehicleCapability,
  startOfMonth: Date,
  endOfMonth: Date
): Promise<number> {
  const odometerHistory = await capability.getOdometerHistory({
    since: startOfMonth,
    until: endOfMonth
  });

  const clamped = filterClampAndSortHistory(odometerHistory, startOfMonth, endOfMonth, false);

  if (clamped.length === 0) {
    return 0;
  }

  // Get the first and last odometer readings
  const startOdometer = clamped[0].value;
  const endOdometer = clamped[clamped.length - 1].value;

  return Math.max(0, endOdometer - startOdometer);
}

/**
 * Estimate the energy (kWh) consumed over a month from the drops in charge
 * percentage. Charging produces increases (which we ignore), so summing the
 * decreases captures the energy consumed while not charging, which we convert
 * to kWh via the known battery capacity.
 */
export async function calculateMonthlyEnergyConsumedKwh(
  capability: ElectricVehicleCapability,
  startOfMonth: Date,
  endOfMonth: Date
): Promise<number> {
  const chargeHistory = await capability.getChargePercentageHistory({
    since: startOfMonth,
    until: endOfMonth
  });

  const clamped = filterClampAndSortHistory(chargeHistory, startOfMonth, endOfMonth, false);

  let percentageConsumed = 0;

  for (let i = 1; i < clamped.length; i++) {
    const delta = clamped[i - 1].value - clamped[i].value;

    if (delta > 0) {
      percentageConsumed += delta;
    }
  }

  return (percentageConsumed / 100) * config.smartcar.battery_capacity_kwh;
}

/**
 * Store monthly mileage and efficiency for a given month
 */
export async function storeMonthlyAggregates(
  capability: ElectricVehicleCapability,
  startOfMonth: Date,
  endOfMonth: Date,
  now: Date
): Promise<void> {
  const miles = await calculateMonthlyMileage(capability, startOfMonth, endOfMonth);
  const kwh = await calculateMonthlyEnergyConsumedKwh(capability, startOfMonth, endOfMonth);
  const efficiency = kwh > 0 ? miles / kwh : 0;

  await capability.setMonthlyMileageState(miles, startOfMonth, now);
  await capability.setMonthlyEfficiencyState(efficiency, startOfMonth, now);

  logger.info(`Monthly mileage for ${dayjs(startOfMonth).format('YYYY-MM')}: ${miles.toFixed(1)} mi, ${efficiency.toFixed(2)} mi/kWh`);
}

export async function ensureHistoricalMonthly(device: Device, capability: ElectricVehicleCapability): Promise<void> {
  const latestEvent = await capability.getMonthlyMileageEvent();
  const now = new Date();
  const endDate = dayjs().startOf('month');
  const startDate = latestEvent === null
    ? dayjs(device.createdAt).startOf('month')
    : dayjs(latestEvent.lastReported).startOf('month');

  for (let month = startDate; month.isBefore(endDate); month = month.add(1, 'month')) {
    const monthStart = month.toDate();
    const monthEnd = month.add(1, 'month').toDate();

    logger.info(`Calculating monthly aggregates for ${month.format('YYYY-MM')}`);
    await storeMonthlyAggregates(capability, monthStart, monthEnd, now);
  }
}
