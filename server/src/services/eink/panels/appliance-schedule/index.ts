import { Device } from '../../../../models';
import config from '../../../../config/app';
import dayjs from '../../../../dayjs';
import nowAndSetCron from '../../../../helpers/now-and-set-cron';
import { createBackgroundTransaction } from '../../../../helpers/newrelic';
import logger from '../../../../logger';
import { toPriceSlots, startOfSlot } from '../../../../helpers/prices';
import { registerPanel } from '../../registry';
import { renderNoDataFrame } from '../../render/canvas';
import { planAppliance } from './plan';
import { loadApplianceProfiles } from './profiles';
import { renderAppliancePanel, AppliancePanelData, AppliancePanelRow, WIDTH, HEIGHT } from './render';

const PANEL_ID = 'appliance-schedule';

// Only ~31h of Agile prices are ever published; asking further ahead just
// returns whatever exists, same rationale as services/octopus's own window.
const FORECAST_HORIZON_HOURS = 48;

// e-ink holds its last image forever, so a stuck render must eventually say
// so rather than sit silently stale. render_cron is every 30 minutes, so 3
// straight failures is 90 minutes before the fallback frame takes over.
const FAILURES_BEFORE_FALLBACK = 3;

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  return devices.length === 0 ? null : devices[0].getEnergyCostCapability();
}

let cachedPng: Buffer = renderNoDataFrame(WIDTH, HEIGHT, 'No data yet');
let cachedJson: unknown = null;
let consecutiveFailures = 0;

async function render(): Promise<void> {
  const energyCost = await getEnergyCostCapability();

  if (energyCost === null) {
    throw new Error('No ENERGY_COST device found to plan appliance runs against');
  }

  const now = new Date();
  const since = startOfSlot(now);
  const until = dayjs(now).add(FORECAST_HORIZON_HOURS, 'hour').toDate();
  const events = await energyCost.getUnitRateHistory({ since, until });
  const slots = toPriceSlots(events, since, until);
  const profiles = loadApplianceProfiles();

  const rows: AppliancePanelRow[] = profiles.map(profile => ({
    profile,
    plan: planAppliance({ slots, now, profile }),
  }));

  const data: AppliancePanelData = { now, rows };

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

nowAndSetCron(createBackgroundTransaction('eink:appliance-schedule:render', async () => {
  try {
    await render();
    consecutiveFailures = 0;
  } catch (e) {
    consecutiveFailures++;
    logger.error(e, `eink appliance-schedule: render failed (${consecutiveFailures} in a row)`);

    if (consecutiveFailures >= FAILURES_BEFORE_FALLBACK) {
      cachedPng = renderNoDataFrame(WIDTH, HEIGHT, 'No data - check karen');
    }
  }
}), config.eink.appliance_schedule.render_cron);

registerPanel({
  id: PANEL_ID,
  width: WIDTH,
  height: HEIGHT,
  renderPng: () => cachedPng,
  renderJson: () => cachedJson,
});
