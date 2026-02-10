import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import * as client from './client';
import { ensureHistoricalMileage, storeWeeklyMileage } from './mileage';
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

// Run charge schedule check and mileage update every 15 minutes
nowAndSetInterval(createBackgroundTransaction('vehicle:charge-schedule', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const ev = device.getElectricVehicleCapability();
  const schedule = device.meta.chargeSchedule as { targetPercentage: number; targetTime: string } | undefined;

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
  const startTime = targetTime.subtract(hoursNeeded, 'hour');

  if (now.isSameOrAfter(startTime)) {
    logger.info(`Starting charge to reach ${schedule.targetPercentage}% by ${targetTime.format('HH:mm')}`);

    await ev.setChargeLimit(schedule.targetPercentage);
    await ev.setIsCharging(true);
  }
}), 15 * 60 * 1000);

nowAndSetInterval(createBackgroundTransaction('vehicle:weekly-mileage', async () => {
  const device = await Device.findByProviderIdOrError('vehicle', config.smartcar.vehicle_id);
  const capability = device.getElectricVehicleCapability();
  const startOfWeek = dayjs().startOf('week').toDate();
  const now = new Date();

  await ensureHistoricalMileage(device, capability);
  await storeWeeklyMileage(capability, startOfWeek, now);
}), 15 * 60 * 1000);