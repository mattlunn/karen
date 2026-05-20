import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import type { Capability } from '../../models/capabilities';
import { getMeterPoint, getConsumption, getUnitRates, getStandingCharges, MeterPoint } from './client';

const PROVIDER_ID = 'electricity-meter';

Device.registerProvider('octopus', {
  getCapabilities(): Capability[] {
    return ['ENERGY_MONITOR', 'ENERGY_COST'];
  },

  async synchronize() {
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
    device.meta.meterPoint = await getMeterPoint();

    await device.save();
  },
});

async function poll(meterPoint: MeterPoint, device: Device) {
  const now = new Date();
  const energyMonitor = device.getEnergyMonitorCapability();
  const energyCost = device.getEnergyCostCapability();

  // Fetches a time-series forward from the latest stored event (or the
  // device's creation when there is none) and applies each item.
  async function sync<T>(
    getLatest: () => Promise<{ start: Date } | null>,
    fetchItems: (since: Date, until: Date) => Promise<T[]>,
    apply: (item: T) => Promise<unknown>
  ) {
    const latest = await getLatest();
    const since = latest?.start ?? device.createdAt;

    for (const item of await fetchItems(since, now)) {
      await apply(item);
    }
  }

  // Consumption: half-hourly kWh, reported with ~24h delay. Convert each
  // slice to an average wattage so the shared energy aggregator can integrate
  // it like any other EnergyMonitor device.
  await sync(
    () => energyMonitor.getCurrentPowerEvent(),
    (since, until) => getConsumption(meterPoint, since, until),
    (interval) => {
      const durationHours = (interval.end.getTime() - interval.start.getTime()) / (60 * 60 * 1000);
      const averageWatts = durationHours > 0 ? Math.round((interval.consumption / durationHours) * 1000) : 0;

      return energyMonitor.setCurrentPowerState(averageWatts, interval.start);
    }
  );

  // Unit rates / standing charges: Octopus publishes these slightly ahead of
  // time, so this naturally records near-future rates too.
  await sync(
    () => energyCost.getUnitRateEvent(),
    (since, until) => getUnitRates(meterPoint, since, until),
    (rate) => energyCost.setUnitRateState(rate.value, rate.start)
  );

  await sync(
    () => energyCost.getStandingChargeEvent(),
    (since, until) => getStandingCharges(meterPoint, since, until),
    (standingCharge) => energyCost.setStandingChargeState(standingCharge.value, standingCharge.start)
  );
}

nowAndSetInterval(createBackgroundTransaction('octopus:poll', async () => {
  const device = await Device.findByProviderIdOrError('octopus', PROVIDER_ID);

  await poll(device.meta.meterPoint as MeterPoint, device);
}), Math.max(config.octopus.poll_interval_minutes, 1) * 60 * 1000);
