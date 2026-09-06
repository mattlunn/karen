import { Device } from '../../../../models';
import config from '../../../../config/app';
import dayjs from '../../../../dayjs';
import nowAndSetCron from '../../../../helpers/now-and-set-cron';
import { createBackgroundTransaction } from '../../../../helpers/newrelic';
import { toPriceSlots, startOfSlot, PriceSlot } from '../../../../helpers/prices';
import { EnergyCostCapability } from '../../../../models/capabilities';
import { registerPanel } from '../../registry';
import { planAppliance } from './plan';
import { loadApplianceProfiles } from './profiles';
import { renderAppliancePanel, AppliancePanelData, AppliancePanelRow, WIDTH, HEIGHT } from './render';

const PANEL_ID = 'appliance-schedule';

// Only ~31h of Agile prices are ever published; asking further ahead just
// returns whatever exists, same rationale as services/octopus's own window.
const FORECAST_HORIZON_HOURS = 48;

async function getEnergyCostCapability() {
  const devices = await Device.findByCapability('ENERGY_COST');

  return devices.length === 0 ? null : devices[0].getEnergyCostCapability();
}

let cachedPng: Buffer | null = null;
let cachedJson: unknown = null;

// Agile publishes tomorrow's prices around 4pm, so a bucket reaching past
// tonight's boundary would otherwise sit empty for hours - backfill it from
// the same slots exactly a day earlier, flagged so the UI can mark it a guess.
async function fillUnpublishedTail(energyCost: EnergyCostCapability, publishedSlots: PriceSlot[], since: Date, until: Date): Promise<PriceSlot[]> {
  const frontier = publishedSlots.length === 0 ? since : publishedSlots.at(-1)!.end;

  if (frontier >= until) {
    return publishedSlots;
  }

  const estimateSince = dayjs(frontier).subtract(1, 'day').toDate();
  const estimateUntil = dayjs(until).subtract(1, 'day').toDate();
  const estimateEvents = await energyCost.getUnitRateHistory({ since: estimateSince, until: estimateUntil });
  const estimateSlots: PriceSlot[] = toPriceSlots(estimateEvents, estimateSince, estimateUntil).map(slot => ({
    start: dayjs(slot.start).add(1, 'day').toDate(),
    end: dayjs(slot.end).add(1, 'day').toDate(),
    pence: slot.pence,
    isEstimated: true,
  }));

  return [...publishedSlots, ...estimateSlots];
}

async function render(): Promise<void> {
  const energyCost = await getEnergyCostCapability();

  if (energyCost === null) {
    throw new Error('No ENERGY_COST device found to plan appliance runs against');
  }

  const now = new Date();
  const since = startOfSlot(now);
  const until = dayjs(now).add(FORECAST_HORIZON_HOURS, 'hour').toDate();
  const events = await energyCost.getUnitRateHistory({ since, until });
  const publishedSlots = toPriceSlots(events, since, until);
  const slots = await fillUnpublishedTail(energyCost, publishedSlots, since, until);
  const profiles = loadApplianceProfiles();

  const rows: AppliancePanelRow[] = profiles.map(profile => ({
    profile,
    plan: planAppliance({
      slots, now, profile,
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
