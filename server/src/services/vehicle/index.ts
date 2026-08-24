import { Device } from '../../models';
import { ElectricVehicleCapability, NextChargeSchedule, ManualChargeSchedule } from '../../models/capabilities';
import config from '../../config/app';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { processSignal } from './signals';
import { ensureHistoricalMonthly, storeMonthlyAggregates } from './mileage';
import { pickNextChargeSchedule, buildScheduleNotification, buildChargingFailureNotification } from './schedule';
import dayjs, { Dayjs } from '../../dayjs';
import logger from '../../logger';
import nowAndSetIntervalForTime from '../../helpers/now-and-set-interval-for-time';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';

export async function synchronize() {
  let device = await Device.findByProviderId('vehicle', config.smartcar.vehicle_id);

  try {
    const signals = await client.getSignals();
    const { make, model, year } = signals.included.vehicle.attributes;

    if (!device) {
      device = Device.build({
        provider: 'vehicle',
        providerId: config.smartcar.vehicle_id,
        name: `${make} ${model}`,
      });
    }

    device.manufacturer = make;
    device.model = `${model} (${year})`;

    await device.save();

    const ev = device.getElectricVehicleCapability();

    for (const signal of signals.data) {
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

// We can't read the charge limit back from SmartCar, so we can't verify the car
// actually accepted it. Instead we watch an in-progress scheduled charge and
// alert if the car is plugged in but not charging. State is transient and
// single-vehicle, so it lives in module variables (not device.meta), keyed to
// the active occurrence's targetTime so it resets when a new occurrence rolls in.
// We deliberately do not self-heal for now — we want to learn how often this
// happens rather than have it silently fixed.
let trackedTargetTime: string | null = null;
let issueNotified = false;

async function verifyChargingProgress(device: Device, ev: ElectricVehicleCapability, now: Dayjs) {
  const stored = device.meta.chargeSchedule as NextChargeSchedule | undefined;

  if (!stored || !stored.calculatedStartTime) {
    return;
  }

  // The alert fires at most once per scheduled occurrence. issueNotified records
  // whether we've already alerted, and trackedTargetTime records which occurrence
  // that flag applies to — so when a new occurrence rolls in (a different
  // targetTime), we reset the flag and let the new one alert afresh.
  if (trackedTargetTime !== stored.targetTime) {
    trackedTargetTime = stored.targetTime;
    issueNotified = false;
  }

  const startTime = dayjs(stored.calculatedStartTime);
  const targetTime = dayjs(stored.targetTime);

  // Only relevant once charging should be underway, until the target time has passed.
  if (!now.isSameOrAfter(startTime) || now.isAfter(targetTime)) {
    return;
  }

  const [isCableConnected, isCharging, chargePercentage] = await Promise.all([
    ev.getIsCableConnected(),
    ev.getIsCharging(),
    ev.getChargePercentage(),
  ]);

  // Nothing to charge (or alert on) if the cable isn't connected — this alert is
  // specifically about being plugged in but not charging. Treat a reconnect as a
  // fresh start so a later failure can alert again.
  if (!isCableConnected) {
    issueNotified = false;
    return;
  }

  const isHealthy = isCharging || chargePercentage >= stored.targetPercentage;

  if (isHealthy) {
    issueNotified = false;
    return;
  }

  if (issueNotified) {
    return;
  }

  logger.error('Charge schedule: car is plugged in but not charging when it should be');

  bus.emit(NOTIFICATION_TO_ADMINS, {
    message: buildChargingFailureNotification(stored.targetPercentage, targetTime),
    priority: 1,
  });

  issueNotified = true;
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
  await verifyChargingProgress(device, ev, now);
}), 15 * 60 * 1000);

nowAndSetIntervalForTime(createBackgroundTransaction('vehicle:monthly-mileage', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();
  const startOfMonth = dayjs().startOf('month').toDate();
  const now = new Date();

  await ensureHistoricalMonthly(device, capability);
  await storeMonthlyAggregates(capability, startOfMonth, now, now);
}), '00:00');
