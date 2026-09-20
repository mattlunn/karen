import { Device } from '../../../../models';
import config from '../../../../config/app';
import dayjs from '../../../../dayjs';
import nowAndSetCron from '../../../../helpers/now-and-set-cron';
import { createBackgroundTransaction } from '../../../../helpers/newrelic';
import { toPriceSlots } from '../../../../helpers/prices';
import { EnergyCostCapability } from '../../../../models/capabilities';
import { registerPanel } from '../../registry';
import { planAppliance } from './plan';
import { loadApplianceProfiles } from './profiles';
import { renderAppliancePanel, AppliancePanelData, AppliancePanelRow, WIDTH, HEIGHT } from './render';

const PANEL_ID = 'appliance-schedule';

const FORECAST_HORIZON_HOURS = 48;
const BASELINE_WINDOW_DAYS = 7;

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  return devices.length === 0 ? null : devices[0].getEnergyCostCapability();
}

let cachedPng: Buffer | null = null;
let cachedJson: unknown = null;

// Flat average pence/kWh over the trailing window - what this appliance
// "normally" costs to run, against which Now and every bucket are judged.
async function getBaselinePencePerKwh(energyCost: EnergyCostCapability, now: Date): Promise<number> {
  const since = dayjs(now).subtract(BASELINE_WINDOW_DAYS, 'day').toDate();
  const events = await energyCost.getUnitRateHistory({ since, until: now });
  const slots = toPriceSlots(events, since, now);

  return slots.reduce((sum, slot) => sum + slot.pence, 0) / slots.length;
}

async function render(): Promise<void> {
  const energyCost = await getEnergyCostCapability();

  if (energyCost === null) {
    throw new Error('No ENERGY_COST device found to plan appliance runs against');
  }

  const now = new Date();
  const slots = await energyCost.getForwardUnitRates(dayjs(now).add(FORECAST_HORIZON_HOURS, 'hour').toDate());
  const baselinePencePerKwh = await getBaselinePencePerKwh(energyCost, now);
  const profiles = loadApplianceProfiles();

  const rows: AppliancePanelRow[] = profiles.map(profile => ({
    profile,
    plan: planAppliance({
      slots, now, profile, baselinePencePerKwh,
      negligibleSavingPence: config.eink.appliance_schedule.negligible_saving_pence,
    }),
  }));

  const data: AppliancePanelData = { now, priceSlots: slots, rows };

  cachedPng = renderAppliancePanel(data);
  cachedJson = {
    now: data.now.toISOString(),
    rows: data.rows.map(row => ({
      id: row.profile.id,
      label: row.profile.label,
      plan: row.plan,
    })),
  };
}

nowAndSetCron(createBackgroundTransaction('eink:appliance-schedule:render', render), config.eink.appliance_schedule.render_cron);

registerPanel({
  id: PANEL_ID,
  width: WIDTH,
  height: HEIGHT,
  renderPng: () => cachedPng,
  renderJson: () => cachedJson,
});
