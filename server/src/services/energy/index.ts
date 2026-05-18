import { Device } from '../../models';
import { EnergyMonitorCapability, EnergyCostCapability } from '../../models/capabilities';
import { NumericEvent } from '../../models/event';
import { filterClampAndSortHistory } from '../../helpers/history';
import { calculateWattHours } from '../../helpers/energy';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import dayjs from '../../dayjs';
import logger from '../../logger';

interface RateSlice {
  start: Date;
  end: Date;
  value: number; // pence per kWh
}

function toRateSlices(rateHistory: NumericEvent[], dayEnd: Date): RateSlice[] {
  return rateHistory.map(rate => ({
    start: rate.start,
    end: rate.end ?? dayEnd,
    value: rate.value
  }));
}

/**
 * Integrates a power history (Watts) against the unit-rate slices that cover
 * the day, returning the cost in pence. Returns null when no rates cover the
 * day so the caller can skip persisting DayCost.
 */
function calculateDayCost(
  powerHistory: NumericEvent[],
  rateSlices: RateSlice[],
  dayStart: Date,
  dayEnd: Date
): number | null {
  const relevant = rateSlices.filter(slice => slice.end > dayStart && slice.start < dayEnd);

  if (relevant.length === 0) {
    return null;
  }

  let pence = 0;

  for (const slice of relevant) {
    const sliceStart = slice.start > dayStart ? slice.start : dayStart;
    const sliceEnd = slice.end < dayEnd ? slice.end : dayEnd;

    if (sliceEnd <= sliceStart) {
      continue;
    }

    const clamped = filterClampAndSortHistory(powerHistory, sliceStart, sliceEnd, false);
    const kWh = calculateWattHours(clamped) / 1000;

    pence += kWh * slice.value;
  }

  return Math.round(pence * 100) / 100;
}

async function storeDailyEnergyForDevice(
  device: Device,
  energyMonitor: EnergyMonitorCapability,
  energyCost: EnergyCostCapability
): Promise<void> {
  const latestDayEnergy = await energyMonitor.getDayEnergyEvent();
  const now = new Date();
  const today = dayjs(now).startOf('day');
  const startDay = latestDayEnergy !== null
    ? dayjs(latestDayEnergy.start).startOf('day')
    : dayjs(device.createdAt).startOf('day');

  for (let day = startDay; day.isSameOrBefore(today); day = day.add(1, 'day').startOf('day')) {
    const dayStart = day.toDate();
    const dayEnd = day.isSame(today, 'day') ? now : day.add(1, 'day').startOf('day').toDate();

    if (dayEnd.getTime() <= dayStart.getTime()) {
      continue;
    }

    const powerHistory = await energyMonitor.getCurrentPowerHistory({ since: dayStart, until: dayEnd });
    const clampedPower = filterClampAndSortHistory(powerHistory, dayStart, dayEnd, false);
    const kWh = Math.round(calculateWattHours(clampedPower) / 10) / 100;

    await energyMonitor.setDayEnergyState(kWh, dayStart);

    const rateHistory = await energyCost.getUnitRateHistory({ since: dayStart, until: dayEnd });
    const cost = calculateDayCost(powerHistory, toRateSlices(rateHistory, dayEnd), dayStart, dayEnd);

    if (cost !== null) {
      await energyMonitor.setDayCostState(cost, dayStart);
    }
  }
}

export async function storeDailyEnergy(): Promise<void> {
  const [monitorDevices, costDevices] = await Promise.all([
    Device.findByCapability('ENERGY_MONITOR'),
    Device.findByCapability('ENERGY_COST'),
  ]);

  if (costDevices.length !== 1) {
    throw new Error(`Expected exactly one EnergyCost device, found ${costDevices.length}`);
  }

  const energyCost = costDevices[0].getEnergyCostCapability();

  for (const device of monitorDevices) {
    try {
      await storeDailyEnergyForDevice(device, device.getEnergyMonitorCapability(), energyCost);
    } catch (e) {
      logger.error(e, `Failed to store daily energy for device ${device.id} (${device.name})`);
    }
  }
}

nowAndSetInterval(createBackgroundTransaction('energy:daily', storeDailyEnergy), 15 * 60 * 1000);
