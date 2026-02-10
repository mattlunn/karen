import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { ensureHistoricalMileage, storeCurrentWeekRunningMileage } from './mileage';
import dayjs from '../../dayjs';
import logger from '../../logger';

Device.registerProvider('vehicle', {
  getCapabilities() {
    return ['ELECTRIC_VEHICLE'];
  },

  provideElectricVehicleCapability() {
    return {
      async setChargeLimit(device: Device, value: number) {
        await client.setChargeLimit(value);
      },
      async setIsCharging(device: Device, value: boolean) {
        if (value) {
          await client.startCharge();
        } else {
          await client.stopCharge();
        }
      }
    };
  },

  async synchronize() {
    const attributes = await client.getVehicleAttributes();
    let device = await Device.findByProviderId('vehicle', config.smartcar.vehicle_id);

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

    // Fetch initial state to seed the database
    try {
      const ev = device.getElectricVehicleCapability();
      const [battery, chargeStatus, odometer, chargeLimit] = await Promise.all([
        client.getBattery(),
        client.getChargeStatus(),
        client.getOdometer(),
        client.getChargeLimit()
      ]);

      await Promise.all([
        ev.setChargePercentageState(battery.percentRemaining),
        ev.setIsChargingState(chargeStatus.state === 'CHARGING'),
        ev.setChargeLimitState(chargeLimit),
        ev.setOdometerState(odometer)
      ]);
    } catch (error) {
      logger.error(error, 'Failed to fetch initial vehicle state');
    }
  }
});

/**
 * Estimate charge rate from recent charging history
 * Returns percentage per hour
 */
async function estimateChargeRate(device: Device): Promise<number> {
  const ev = device.getElectricVehicleCapability();

  // Get charge percentage and charging status from the last 2 hours
  const since = dayjs().subtract(2, 'hours').toDate();
  const until = new Date();

  const [chargeHistory, chargingHistory] = await Promise.all([
    ev.getChargePercentageHistory({ since, until }),
    ev.getIsChargingHistory({ since, until })
  ]);

  if (chargeHistory.length < 2 || chargingHistory.length === 0) {
    return 10; // Fallback: 10% per hour
  }

  // Calculate total time spent charging
  let totalChargingMinutes = 0;
  for (const period of chargingHistory) {
    if (period.end) {
      totalChargingMinutes += dayjs(period.end).diff(period.start, 'minute');
    }
  }

  if (totalChargingMinutes === 0) {
    return 10; // Fallback
  }

  // Calculate percentage gained
  const startPercentage = chargeHistory[0].value;
  const endPercentage = chargeHistory[chargeHistory.length - 1].value;
  const percentageGained = endPercentage - startPercentage;

  if (percentageGained <= 0) {
    return 10; // Fallback
  }

  // Calculate rate per hour
  const hoursCharging = totalChargingMinutes / 60;
  return percentageGained / hoursCharging;
}

/**
 * Charge scheduling check - runs every 15 minutes
 */
async function checkChargeSchedule(): Promise<void> {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();

  const schedule = device.meta.chargeSchedule as { targetPercentage: number; targetTime: string } | undefined;

  if (!schedule) {
    return; // No schedule
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

  // Get current charge percentage
  const currentPercentage = await ev.getChargePercentage();

  // If already at or above target, nothing to do
  if (currentPercentage >= schedule.targetPercentage) {
    return;
  }

  // Check if already charging
  const isCharging = await ev.getIsCharging();
  if (isCharging) {
    return; // Already charging
  }

  // Estimate charge rate
  const chargeRate = await estimateChargeRate(device);

  // Calculate how long we need to charge
  const percentageNeeded = schedule.targetPercentage - currentPercentage;
  const hoursNeeded = percentageNeeded / chargeRate;

  // Calculate when we should start
  const startTime = targetTime.subtract(hoursNeeded, 'hour');

  // If it's time to start, begin charging
  if (now.isAfter(startTime) || now.isSame(startTime)) {
    logger.info(`Starting charge to reach ${schedule.targetPercentage}% by ${targetTime.format('HH:mm')}`);
    await ev.setChargeLimit(schedule.targetPercentage);
    await ev.setIsCharging(true);
  }
}

/**
 * Weekly mileage calculation - runs every 15 minutes
 */
async function updateWeeklyMileage(): Promise<void> {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();

  await ensureHistoricalMileage(device, capability);
  await storeCurrentWeekRunningMileage(capability);
}

// Run charge schedule check and mileage update every 15 minutes
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  try {
    await checkChargeSchedule();
  } catch (error) {
    logger.error(error, 'Error checking charge schedule');
  }
}), 15 * 60 * 1000);

nowAndSetInterval(createBackgroundTransaction('vehicle:weekly-mileage', async () => {
  try {
    await updateWeeklyMileage();
  } catch (error) {
    logger.error(error, 'Error updating weekly mileage');
  }
}), 15 * 60 * 1000);
