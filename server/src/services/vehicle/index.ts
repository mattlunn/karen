import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMileage, storeWeeklyMileage } from './mileage';
import dayjs from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

export async function synchronize() {
  let device = await Device.findByProviderId('vehicle', config.smartcar.vehicle_id);
  const attributes = await client.getVehicleAttributes();

  if (!device) {
    device = Device.build({
      provider: 'vehicle',
      providerId: config.smartcar.vehicle_id,
      name: `${attributes.make} ${attributes.model}`,
    });
  }

  device.manufacturer = attributes.make;
  device.model = `${attributes.model} (${attributes.year})`;

  await device.save();

  const ev = device.getElectricVehicleCapability();
  const signals = await client.getSignals();

  for (const signal of signals.body.data) {
    try {
      await processSignal(ev, signal.attributes);
    } catch (error) {
      logger.error(error, `Error processing signal ${signal.attributes.code}`);
    }
  }

  // We can't get the charge limit from SmartCar, so just one time force to 100
  // so we are in-sync with what's set.
  if (await ev.getChargeLimitEvent() === null) {
    await client.setChargeLimit(100);
  }
}

Device.registerProvider('vehicle', {
  getCapabilities() {
    return ['ELECTRIC_VEHICLE'];
  },

  provideElectricVehicleCapability() {
    return {
      async setChargeLimit(device: Device, value: number) {
        await client.setChargeLimit(value);
        await device.getElectricVehicleCapability().setChargeLimitState(value);
      },

      async setIsCharging(_device: Device, value: boolean) {
        if (value) {
          await client.startCharge();
        } else {
          await client.stopCharge();
        }
      }
    };
  },

  synchronize,
});

/**
 * Estimate charge rate from recent charging history.
 * Returns percentage per hour.
 *
 * Algorithm:
 * (a) Find when the cable was plugged in (start of current cable-connected session)
 * (b) Within that window, find periods where IsCharging = true
 * (c) For each charging period, calculate the charge % gained
 * (d) Return total % gained / total hours charging
 * Falls back to config.smartcar.default_charge_rate_pct_per_hour if no usable data.
 */
async function estimateChargeRate(device: Device): Promise<number> {
  const fallback = config.smartcar.default_charge_rate_pct_per_hour;
  const ev = device.getElectricVehicleCapability();
  const until = new Date();

  // (a) Find the start of the current cable-connected session
  const cableEvent = await ev.getIsCableConnectedEvent();

  if (!cableEvent || !cableEvent.value) {
    return fallback;
  }

  const pluggedInAt = cableEvent.start;

  // (b) Find charging periods within the cable-connected window
  const [chargingHistory, chargeHistory] = await Promise.all([
    ev.getIsChargingHistory({ since: pluggedInAt, until }),
    ev.getChargePercentageHistory({ since: pluggedInAt, until }),
  ]);

  const chargingPeriods = chargingHistory.filter(p => p.value);

  if (chargingPeriods.length === 0) {
    return fallback;
  }

  // (c) For each charging period, find the charge % delta
  let totalPercentageGained = 0;
  let totalChargingMinutes = 0;

  for (const period of chargingPeriods) {
    const periodEnd = period.end ?? until;
    const periodDurationMinutes = dayjs(periodEnd).diff(period.start, 'minute');

    if (periodDurationMinutes <= 0) {
      continue;
    }

    // Find charge readings that fall within this charging period
    const readings = chargeHistory.filter(r => {
      const readingEnd = r.end ?? until;
      return r.start <= periodEnd && readingEnd >= period.start;
    });

    if (readings.length < 2) {
      continue;
    }

    const startCharge = readings[0].value;
    const endCharge = readings[readings.length - 1].value;
    const delta = endCharge - startCharge;

    if (delta <= 0) {
      continue;
    }

    totalPercentageGained += delta;
    totalChargingMinutes += periodDurationMinutes;
  }

  if (totalChargingMinutes === 0 || totalPercentageGained <= 0) {
    return fallback;
  }

  return totalPercentageGained / (totalChargingMinutes / 60);
}

// Run charge schedule check and mileage update every 15 minutes
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const schedule = device.meta.chargeSchedule as { targetPercentage: number; targetTime: string; calculatedStartTime?: string | null } | undefined;

  if (!schedule) {
    return;
  }

  const targetTime = dayjs(schedule.targetTime);
  const now = dayjs();

  // If target time has passed, clear schedule and reset charge limit
  if (now.isAfter(targetTime)) {
    logger.info('Charge schedule target time passed, resetting charge limit');
    device.meta.chargeSchedule = undefined;

    await device.save();
    await ev.setChargeLimit(config.smartcar.default_charge_limit);

    return;
  }

  const currentPercentage = await ev.getChargePercentage();

  if (currentPercentage >= schedule.targetPercentage) {
    return;
  }

  const chargeRate = await estimateChargeRate(device);
  const percentageNeeded = schedule.targetPercentage - currentPercentage;
  const hoursNeeded = percentageNeeded / chargeRate;
  const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
  const startTime = targetTime.subtract(hoursNeeded + bufferHours, 'hour');

  device.meta.chargeSchedule = { ...schedule, calculatedStartTime: startTime.toISOString() };
  await device.save();

  if (now.isSameOrAfter(startTime)) {
    logger.info(`Starting charge to reach ${schedule.targetPercentage}% by ${targetTime.format('HH:mm')}`);

    await ev.setChargeLimit(schedule.targetPercentage);

    const isCableConnected = await ev.getIsCableConnected();

    if (isCableConnected) {
      await ev.setIsCharging(true);
      bus.emit(NOTIFICATION_TO_ADMINS, { message: `Car charging started: targeting ${schedule.targetPercentage}% by ${targetTime.format('HH:mm')}` });
    } else {
      logger.warn('Charge schedule: cable not connected, cannot start charging');
      bus.emit(NOTIFICATION_TO_ADMINS, { message: `Car needs to be plugged in to allow scheduled charge to ${schedule.targetPercentage}% by ${targetTime.format('HH:mm')}` });
    }
  }
}), 15 * 60 * 1000);

nowAndSetIntervalForTime(createBackgroundTransaction('vehicle:weekly-mileage', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();
  const startOfWeek = dayjs().startOf('week').toDate();
  const now = new Date();

  await ensureHistoricalMileage(device, capability);
  await storeWeeklyMileage(capability, startOfWeek, now);
}), '00:00');