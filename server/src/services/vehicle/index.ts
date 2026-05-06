import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMileage, storeWeeklyMileage } from './mileage';
import { pickActiveOccurrence, buildScheduleNotification, ChargeScheduleOverride } from './schedule';
import dayjs from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

interface StoredChargeSchedule {
  targetTime: string;
  calculatedStartTime: string;
  hasStarted: boolean;
}

export async function synchronize() {
  let device = await Device.findByProviderId('vehicle', config.smartcar.vehicle_id);

  try {
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

    await device.getConnectivityCapability().setIsConnectedState(true);
  } catch (e) {
    if (device) {
      await device.getConnectivityCapability().setIsConnectedState(false);
    }
    throw e;
  }
}

Device.registerProvider('vehicle', {
  getCapabilities() {
    return ['ELECTRIC_VEHICLE', 'CONNECTIVITY'];
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

// Run charge schedule check every 15 minutes
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const now = dayjs();
  const stored = device.meta.chargeSchedule as StoredChargeSchedule | undefined;

  // 1. Roll-over: the occurrence we were tracking has now passed.
  //    Reset the charge limit and consume the override if it was the source.
  if (stored && now.isAfter(dayjs(stored.targetTime))) {
    logger.info('Charge schedule target time passed, resetting charge limit');
    await ev.setChargeLimit(config.smartcar.default_charge_limit);

    const override = device.meta.chargeScheduleOverride as ChargeScheduleOverride | null | undefined;
    if (override && dayjs(override.targetTime).isSame(dayjs(stored.targetTime))) {
      device.meta.chargeScheduleOverride = null;
    }

    device.meta.chargeSchedule = undefined;
    await device.save();
  }

  // 2. Re-derive the active occurrence from config + override on each tick.
  const override = (device.meta.chargeScheduleOverride ?? null) as ChargeScheduleOverride | null;
  const active = pickActiveOccurrence(config.smartcar.chargeSchedules ?? [], override, now);

  if (!active) {
    return;
  }

  const previous = device.meta.chargeSchedule as StoredChargeSchedule | undefined;
  const isNewOccurrence = !previous || previous.targetTime !== active.targetTime.toISOString();

  if (await ev.getChargePercentage() >= active.targetPercentage) {
    if (isNewOccurrence) {
      device.meta.chargeSchedule = {
        targetTime: active.targetTime.toISOString(),
        calculatedStartTime: active.targetTime.toISOString(),
        hasStarted: true,
      } satisfies StoredChargeSchedule;
      await device.save();
    }

    return;
  }

  // 3. Recompute calculatedStartTime each cycle (drifts with charge rate / current %).
  const chargeRate = await estimateChargeRate(device);
  const percentageNeeded = active.targetPercentage - await ev.getChargePercentage();
  const hoursNeeded = percentageNeeded / chargeRate;
  const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
  const startTime = active.targetTime.subtract(hoursNeeded + bufferHours, 'hour');

  const hasStarted = !isNewOccurrence && (previous?.hasStarted ?? false);

  device.meta.chargeSchedule = {
    targetTime: active.targetTime.toISOString(),
    calculatedStartTime: startTime.toISOString(),
    hasStarted,
  } satisfies StoredChargeSchedule;
  await device.save();

  // 4. Fire start actions exactly once per occurrence.
  if (now.isSameOrAfter(startTime) && !hasStarted) {
    logger.info(`Starting charge to reach ${active.targetPercentage}% by ${active.targetTime.format('HH:mm')}`);

    await ev.setChargeLimit(active.targetPercentage);

    const isCableConnected = await ev.getIsCableConnected();

    if (isCableConnected) {
      await ev.setIsCharging(true);
    } else {
      logger.warn('Charge schedule: cable not connected, cannot start charging');
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(active.targetPercentage, startTime, active.targetTime, isCableConnected),
    });

    device.meta.chargeSchedule = {
      ...(device.meta.chargeSchedule as StoredChargeSchedule),
      hasStarted: true,
    } satisfies StoredChargeSchedule;
    await device.save();
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