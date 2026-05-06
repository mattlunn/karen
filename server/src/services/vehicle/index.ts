import { Device } from '../../models';
import { NextChargeSchedule, ManualChargeSchedule } from '../../models/capabilities';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMileage, storeWeeklyMileage } from './mileage';
import { pickNextChargeSchedule, buildScheduleNotification } from './schedule';
import dayjs from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

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
        const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;
        if (stored) return stored;

        const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], dayjs());
        if (!next) return null;

        return {
          targetPercentage: next.targetPercentage,
          targetTime: next.targetTime.toISOString(),
          calculatedStartTime: null,
        };
      },

      async setManualChargeSchedule(device: Device, schedule: ManualChargeSchedule | null) {
        device.meta.chargeSchedule = schedule ? {
          targetPercentage: schedule.targetPercentage,
          targetTime: schedule.targetTime,
          calculatedStartTime: null,
        } satisfies NextChargeSchedule : undefined;
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
  let stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  // 1. Roll-over: the stored target has now passed.
  if (stored && now.isAfter(dayjs(stored.targetTime))) {
    logger.info('Charge schedule target time passed, resetting charge limit');
    await ev.setChargeLimit(config.smartcar.default_charge_limit);
    device.meta.chargeSchedule = undefined;
    stored = undefined;
    await device.save();
  }

  // 2. Nothing scheduled? Pick the next config occurrence.
  if (!stored) {
    const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], now);
    if (!next) return;
    stored = {
      targetPercentage: next.targetPercentage,
      targetTime: next.targetTime.toISOString(),
      calculatedStartTime: null,
    };
  }

  // 3. Recompute calculatedStartTime (drifts with current %).
  const chargeRate = config.smartcar.default_charge_rate_pct_per_hour;
  const percentageNeeded = stored.targetPercentage - await ev.getChargePercentage();
  const hoursNeeded = percentageNeeded / chargeRate;
  const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
  const targetTime = dayjs(stored.targetTime);
  const startTime = targetTime.subtract(hoursNeeded + bufferHours, 'hour');

  device.meta.chargeSchedule = {
    ...stored,
    calculatedStartTime: startTime.toISOString(),
  } satisfies NextChargeSchedule;
  await device.save();

  // 4. Fire start actions when past startTime, gated on the live charge limit
  //    so the SmartCar API and notification fire exactly once per occurrence.
  if (now.isSameOrAfter(startTime) && await ev.getChargeLimit() !== stored.targetPercentage) {
    logger.info(`Starting charge to reach ${stored.targetPercentage}% by ${targetTime.format('HH:mm')}`);

    await ev.setChargeLimit(stored.targetPercentage);

    const isCableConnected = await ev.getIsCableConnected();

    if (isCableConnected) {
      await ev.setIsCharging(true);
    } else {
      logger.warn('Charge schedule: cable not connected, cannot start charging');
    }

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(stored.targetPercentage, startTime, targetTime, isCableConnected),
    });
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
