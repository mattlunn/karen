import { Device } from '../../models';
import config from '../../config/app';
import dayjs from '../../dayjs';
import nowAndSetCron from '../../helpers/now-and-set-cron';
import setCron from '../../helpers/set-cron';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import bus, { NOTIFICATION_TO_ADMINS } from '../../bus';
import logger from '../../logger';
import { haveForecastThrough } from '../../helpers/prices';
import type { Capability } from '../../models/capabilities';
import { getAgreements, getUnitRates, getStandingCharges, getSmartMeterDeviceId, getTelemetry } from './client';

const PROVIDER_ID = 'electricity-meter';

// How far ahead of `now` to ask Octopus for unit rates / standing charges.
// Agile's real horizon peaks at ~31h (the ~16:00 publish covers through 23:00
// the following day), so 24 would truncate the most valuable part. `period_to`
// is only an upper bound, so over-asking just returns whatever exists.
const FORWARD_WINDOW_HOURS = 48;

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

    device.meta.telemetryDeviceId = await getSmartMeterDeviceId(config.octopus.account_number);

    await device.save();
  },
});

// Fetches a time-series forward from the latest stored event (or the
// device's creation when there is none) and applies each item.
async function sync<T>(
  device: Device,
  until: Date,
  getLatest: () => Promise<{ start: Date } | null>,
  fetchItems: (since: Date, until: Date) => Promise<T[]>,
  apply: (item: T) => Promise<unknown>
) {
  const latest = await getLatest();
  const since = latest?.start ?? device.createdAt;

  for (const item of await fetchItems(since, until)) {
    await apply(item);
  }
}

// Unit rates / standing charges only - current power comes from the live
// smart-meter telemetry poll below, since Octopus's half-hourly consumption
// endpoint runs ~24h (or more) behind and shouldn't be presented as "current".
async function pollRates(device: Device) {
  const until = dayjs().add(FORWARD_WINDOW_HOURS, 'hour').toDate();
  const agreements = await getAgreements();
  const energyCost = device.getEnergyCostCapability();

  // Unit rates / standing charges: on Agile, Octopus publishes the next day's
  // rates around 16:00, so fetching ahead of `now` records them as ordinary
  // forward-dated events for the DHW / EV schedulers to plan against.
  await sync(
    device, until,
    () => energyCost.getUnitRateEvent(),
    (since, to) => getUnitRates(agreements, since, to),
    (rate) => energyCost.setUnitRateState(rate.value, rate.start)
  );

  await sync(
    device, until,
    () => energyCost.getStandingChargeEvent(),
    (since, to) => getStandingCharges(agreements, since, to),
    (standingCharge) => energyCost.setStandingChargeState(standingCharge.value, standingCharge.start)
  );
}

// Checked once each evening: if we don't hold unit rates covering the next 24h
// (on Agile, tomorrow's publish ~16:00-19:00), the DHW / EV schedulers can't
// plan and just sit off - so tell admins.
async function checkForwardPricesAvailable() {
  const device = await Device.findByProviderIdOrError('octopus', PROVIDER_ID);
  const now = new Date();
  const until = dayjs(now).add(24, 'hour').toDate();
  const events = await device.getEnergyCostCapability().getUnitRateHistory({ since: now, until });

  if (haveForecastThrough(events, until)) {
    return;
  }

  logger.warn('Octopus: no forward prices for the next 24h');

  bus.emit(NOTIFICATION_TO_ADMINS, {
    message: 'No Agile Octopus prices available yet. Devices relying on forecasting (e.g. DHW and EV) are impacted.',
  });
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

nowAndSetCron(createBackgroundTransaction('octopus:poll-rates', async () => {
  const device = await Device.findByProviderIdOrError('octopus', PROVIDER_ID);

  await pollRates(device);
}), config.octopus.poll_rates_cron);

nowAndSetCron(createBackgroundTransaction('octopus:poll-current-power', async () => {
  const device = await Device.findByProviderIdOrError('octopus', PROVIDER_ID);

  await pollCurrentPower(device);
}), config.octopus.poll_current_power_cron);

setCron(
  createBackgroundTransaction('octopus:forward-price-check', checkForwardPricesAvailable),
  config.octopus.forward_price_check_cron
);
