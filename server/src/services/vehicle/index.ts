import { Device } from '../../models';
import { ElectricVehicleCapability, NextChargeSchedule, ManualChargeSchedule } from '../../models/capabilities';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMileage, storeWeeklyMileage } from './mileage';
import { pickNextChargeSchedule, buildScheduleNotification } from './schedule';
import dayjs, { Dayjs } from '../../dayjs';
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
        await processSignal(device, signal.attributes);
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
    return ['ELECTRIC_VEHICLE', 'ENERGY_MONITOR', 'CONNECTIVITY'];
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

        if (stored) {
          return stored;
        }

        const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], dayjs());

        if (!next) {
          return null;
        }

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

async function clearNextChargeIfExpired(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  if (!stored || !now.isAfter(dayjs(stored.targetTime))) {
    return;
  }

  logger.info('Charge schedule target time passed, resetting charge limit');

  device.meta.chargeSchedule = undefined;

  await ev.setChargeLimit(config.smartcar.default_charge_limit);
  await device.save();
}

async function chooseNextCharge(device: Device, now: Dayjs) {
  if (device.meta.chargeSchedule) {
    return;
  }

  const next = pickNextChargeSchedule(config.smartcar.charge_schedules ?? [], now);

  if (!next) {
    return;
  }

  device.meta.chargeSchedule = {
    targetPercentage: next.targetPercentage,
    targetTime: next.targetTime.toISOString(),
    calculatedStartTime: null,
  } satisfies NextChargeSchedule;
}

async function recomputeStartTimeForNextCharge(device: Device, ev: ElectricVehicleCapability) {
  const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  if (!stored) {
    return;
  }

  const chargeRate = (config.smartcar.charge_power_watts / 1000) / config.smartcar.battery_capacity_kwh * 100;
  const percentageNeeded = stored.targetPercentage - await ev.getChargePercentage();
  const hoursNeeded = percentageNeeded / chargeRate;
  const bufferHours = config.smartcar.charge_start_buffer_hours ?? 0;
  const startTime = dayjs(stored.targetTime).subtract(hoursNeeded + bufferHours, 'hour');

  device.meta.chargeSchedule = {
    ...stored,
    calculatedStartTime: startTime.toISOString(),
  } satisfies NextChargeSchedule;

  await device.save();
}

// Gated on the live charge limit so the SmartCar API and the notification
// fire exactly once per occurrence — re-firing only happens if the limit
// is reset (e.g. the next occurrence rolls in).
async function startChargingAndNotifyUsers(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  if (!stored || !stored.calculatedStartTime) {
    return;
  }

  const startTime = dayjs(stored.calculatedStartTime);

  if (!now.isSameOrAfter(startTime)) {
    return;
  }

  if (await ev.getChargeLimit() === stored.targetPercentage) {
    return;
  }

  const targetTime = dayjs(stored.targetTime);

  logger.info(`Starting charge to reach ${stored.targetPercentage}% by ${targetTime.format('HH:mm')}`);

  await ev.setChargeLimit(stored.targetPercentage);

  const isCableConnected = await ev.getIsCableConnected();

  if (isCableConnected) {
    await ev.setIsCharging(true);

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(stored.targetPercentage, startTime, targetTime, true),
    });
  } else {
    logger.warn('Charge schedule: cable not connected, cannot start charging');

    bus.emit(NOTIFICATION_TO_ADMINS, {
      message: buildScheduleNotification(stored.targetPercentage, startTime, targetTime, false),
    });
  }
}

// Run charge schedule check every 15 minutes
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const now = dayjs();

  await clearNextChargeIfExpired(device, ev, now);
  await chooseNextCharge(device, now);
  await recomputeStartTimeForNextCharge(device, ev);
  await startChargingAndNotifyUsers(device, ev, now);
}), 15 * 60 * 1000);

nowAndSetIntervalForTime(createBackgroundTransaction('vehicle:weekly-mileage', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();
  const startOfWeek = dayjs().startOf('week').toDate();
  const now = new Date();

  await ensureHistoricalMileage(device, capability);
  await storeWeeklyMileage(capability, startOfWeek, now);
}), '00:00');
