import { Device } from '../../models';
import { NextChargeSchedule, ManualChargeSchedule } from '../../models/capabilities';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMileage, storeWeeklyMileage } from './mileage';
import { pickNextChargeSchedule, buildScheduleNotification, NextChargeOccurrence } from './schedule';
import dayjs from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

interface StoredChargeSchedule {
  targetTime: string;
  calculatedStartTime: string;
  hasStarted: boolean;
}

function getNextOccurrenceForDevice(device: Device, now = dayjs()): NextChargeOccurrence | null {
  const manual = (device.meta.manualChargeSchedule ?? null) as ManualChargeSchedule | null;
  return pickNextChargeSchedule(config.smartcar.chargeSchedules ?? [], manual, now);
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
      },

      getNextChargeSchedule(device: Device): NextChargeSchedule | null {
        const next = getNextOccurrenceForDevice(device);
        if (!next) return null;

        const stored = device.meta.chargeSchedule as StoredChargeSchedule | undefined;
        const calculatedStartTime = stored && stored.targetTime === next.targetTime.toISOString()
          ? stored.calculatedStartTime
          : null;

        return {
          targetPercentage: next.targetPercentage,
          targetTime: next.targetTime.toISOString(),
          calculatedStartTime,
        };
      },

      async setManualChargeSchedule(device: Device, schedule: ManualChargeSchedule | null) {
        device.meta.manualChargeSchedule = schedule;
        device.meta.chargeSchedule = undefined;
        await device.save();
      },
    };
  },

  synchronize,
});

// Run charge schedule check every 15 minutes
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const now = dayjs();
  const stored = device.meta.chargeSchedule as StoredChargeSchedule | undefined;

  // 1. Roll-over: the occurrence we were tracking has now passed.
  //    Reset the charge limit and consume the manual schedule if it was the source.
  if (stored && now.isAfter(dayjs(stored.targetTime))) {
    logger.info('Charge schedule target time passed, resetting charge limit');
    await ev.setChargeLimit(config.smartcar.default_charge_limit);

    const manual = device.meta.manualChargeSchedule as ManualChargeSchedule | null | undefined;
    if (manual && dayjs(manual.targetTime).isSame(dayjs(stored.targetTime))) {
      device.meta.manualChargeSchedule = null;
    }

    device.meta.chargeSchedule = undefined;
    await device.save();
  }

  // 2. Re-derive the next occurrence from config + manual schedule on each tick.
  const next = getNextOccurrenceForDevice(device, now);

  if (!next) {
    return;
  }

  const previous = device.meta.chargeSchedule as StoredChargeSchedule | undefined;
  const isNewOccurrence = !previous || previous.targetTime !== next.targetTime.toISOString();

  if (await ev.getChargePercentage() >= next.targetPercentage) {
    if (isNewOccurrence) {
      device.meta.chargeSchedule = {
        targetTime: next.targetTime.toISOString(),
        calculatedStartTime: next.targetTime.toISOString(),
        hasStarted: true,
      } satisfies StoredChargeSchedule;
      await device.save();
    }

    return;
  }

  // 3. Recompute calculatedStartTime each cycle (drifts with current %).
  const chargeRate = config.smartcar.default_charge_rate_pct_per_hour;
  const percentageNeeded = next.targetPercentage - await ev.getChargePercentage();
  const hoursNeeded = percentageNeeded / chargeRate;
  const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
  const startTime = next.targetTime.subtract(hoursNeeded + bufferHours, 'hour');

  const hasStarted = !isNewOccurrence && (previous?.hasStarted ?? false);

  device.meta.chargeSchedule = {
    targetTime: next.targetTime.toISOString(),
    calculatedStartTime: startTime.toISOString(),
    hasStarted,
  } satisfies StoredChargeSchedule;
  await device.save();

  // 4. Fire start actions exactly once per occurrence.
  if (now.isSameOrAfter(startTime) && !hasStarted) {
    logger.info(`Starting charge to reach ${next.targetPercentage}% by ${next.targetTime.format('HH:mm')}`);

    await ev.setChargeLimit(next.targetPercentage);

    const isCableConnected = await ev.getIsCableConnected();

    if (isCableConnected) {
      await ev.setIsCharging(true);
    } else {
      logger.warn('Charge schedule: cable not connected, cannot start charging');
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(next.targetPercentage, startTime, next.targetTime, isCableConnected),
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
