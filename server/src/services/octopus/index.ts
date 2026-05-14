import { Device } from '../../models';
import config from '../../config';
import logger from '../../logger';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import type { Capability } from '../../models/capabilities';
import { getMeterPoint, getConsumption, getUnitRates, getStandingCharges, isConfigured, MeterPoint } from './client';

const PROVIDER_ID = 'electricity-meter';

Device.registerProvider('octopus', {
  getCapabilities(): Capability[] {
    return ['ENERGY_MONITOR', 'ENERGY_COST'];
  },

  async synchronize() {
    if (!isConfigured()) {
      return;
    }

    let device = await Device.findByProviderId('octopus', PROVIDER_ID);

    if (device === null) {
      device = Device.build({
        provider: 'octopus',
        providerId: PROVIDER_ID,
        name: 'Electricity Meter',
      });
    }

    device.manufacturer = 'Octopus Energy';
    device.model = 'Smart Meter';

    await device.save();
  },
});

async function poll(meterPoint: MeterPoint, device: Device) {
  const now = new Date();
  const energyMonitor = device.getEnergyMonitorCapability();
  const energyCost = device.getEnergyCostCapability();

  // Consumption: half-hourly kWh, reported with ~24h delay. Convert each
  // slice to an average wattage so the shared energy aggregator can integrate
  // it like any other EnergyMonitor device.
  const lastConsumption = await energyMonitor.getCurrentPowerEvent();
  const consumptionSince = lastConsumption?.start ?? device.createdAt;
  const consumption = await getConsumption(meterPoint, consumptionSince, now);

  for (const interval of consumption) {
    const durationHours = (interval.end.getTime() - interval.start.getTime()) / (60 * 60 * 1000);
    const averageWatts = durationHours > 0 ? Math.round((interval.consumption / durationHours) * 1000) : 0;

    await energyMonitor.setCurrentPowerState(averageWatts, interval.start);
  }

  // Unit rates / standing charges: Octopus publishes these slightly ahead of
  // time, so this naturally records near-future rates too.
  const lastRate = await energyCost.getUnitRateEvent();
  const ratesSince = lastRate?.start ?? device.createdAt;
  const unitRates = await getUnitRates(meterPoint, ratesSince, now);

  for (const rate of unitRates) {
    await energyCost.setUnitRateState(rate.value, rate.start);
  }

  const lastStandingCharge = await energyCost.getStandingChargeEvent();
  const standingChargesSince = lastStandingCharge?.start ?? device.createdAt;
  const standingCharges = await getStandingCharges(meterPoint, standingChargesSince, now);

  for (const standingCharge of standingCharges) {
    await energyCost.setStandingChargeState(standingCharge.value, standingCharge.start);
  }
}

nowAndSetInterval(createBackgroundTransaction('octopus:poll', async () => {
  if (!isConfigured()) {
    return;
  }

  const device = await Device.findByProviderId('octopus', PROVIDER_ID);

  if (device === null) {
    logger.warn('Octopus device has not been synchronized yet; skipping poll');
    return;
  }

  const meterPoint = await getMeterPoint();

  await poll(meterPoint, device);
}), Math.max(config.octopus?.poll_interval_minutes ?? 60, 1) * 60 * 1000);
