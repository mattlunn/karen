import { Device } from '../../models';
import config from '../../config/app';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import type { Capability } from '../../models/capabilities';
import { getTariff, getUnitRates, getStandingCharges, getSmartMeterDeviceId, getTelemetry } from './client';

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

    const { tariffCode, productCode } = await getTariff();
    device.meta.tariffCode = tariffCode;
    device.meta.productCode = productCode;
    device.meta.telemetryDeviceId = await getSmartMeterDeviceId(config.octopus.account_number);

    await device.save();
  },
});

// Fetches a time-series forward from the latest stored event (or the
// device's creation when there is none) and applies each item.
async function sync<T>(
  device: Device,
  now: Date,
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

// Unit rates / standing charges only - current power comes from the live
// smart-meter telemetry poll below, since Octopus's half-hourly consumption
// endpoint runs ~24h (or more) behind and shouldn't be presented as "current".
async function pollRates(device: Device) {
  const now = new Date();
  const tariffCode = device.meta.tariffCode as string;
  const productCode = device.meta.productCode as string;
  const energyCost = device.getEnergyCostCapability();

  // Unit rates / standing charges: Octopus publishes these slightly ahead of
  // time, so this naturally records near-future rates too.
  await sync(
    device, now,
    () => energyCost.getUnitRateEvent(),
    (since, until) => getUnitRates(tariffCode, productCode, since, until),
    (rate) => energyCost.setUnitRateState(rate.value, rate.start)
  );

  await sync(
    device, now,
    () => energyCost.getStandingChargeEvent(),
    (since, until) => getStandingCharges(tariffCode, productCode, since, until),
    (standingCharge) => energyCost.setStandingChargeState(standingCharge.value, standingCharge.start)
  );
}

// Home Mini telemetry: near-real-time (sub-minute) wattage readings, polled
// far more frequently than the half-hourly consumption/rates data above.
async function pollCurrentPower(device: Device) {
  const telemetryDeviceId = device.meta.telemetryDeviceId as string | undefined;

  // synchronize() persists this and runs fire-and-forget at provider
  // registration, so it may not have completed yet on a fresh start - skip
  // this tick and pick it up on the next one rather than calling the API
  // with no device id.
  if (!telemetryDeviceId) {
    return;
  }

  const now = new Date();
  const energyMonitor = device.getEnergyMonitorCapability();

  await sync(
    device, now,
    () => energyMonitor.getCurrentPowerEvent(),
    (since, until) => getTelemetry(telemetryDeviceId, since, until),
    (reading) => energyMonitor.setCurrentPowerState(reading.demandWatts, reading.readAt, now)
  );
}

nowAndSetInterval(createBackgroundTransaction('octopus:poll-rates', async () => {
  const device = await Device.findByProviderIdOrError('octopus', PROVIDER_ID);

  await pollRates(device);
}), Math.max(config.octopus.poll_rates_interval_minutes, 1) * 60 * 1000);

nowAndSetInterval(createBackgroundTransaction('octopus:poll-current-power', async () => {
  const device = await Device.findByProviderIdOrError('octopus', PROVIDER_ID);

  await pollCurrentPower(device);
}), Math.max(config.octopus.poll_current_power_interval_minutes, 1) * 60 * 1000);
