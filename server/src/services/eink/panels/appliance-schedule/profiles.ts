import config from '../../../../config/app';
import { ApplianceProfile, composeProfiles } from './plan';

function toProfile(a: typeof config.eink.appliance_schedule.appliances[number]): ApplianceProfile {
  return {
    id: a.id,
    label: a.label,
    cycleMinutes: a.cycle_minutes,
    powerProfileKwh: a.power_profile_kwh,
    delayMinHours: a.delay_min_hours,
    delayMaxHours: a.delay_max_hours,
  };
}

// The composed wash-then-dry row isn't itself in config.appliances - it's
// built by referencing two of them, so a config edit to either leg (a new
// cycle_minutes, a corrected power profile) only needs to happen once.
export function loadApplianceProfiles(): ApplianceProfile[] {
  const { appliances, wash_then_dry, transfer_gap_minutes } = config.eink.appliance_schedule;
  const base = appliances.map(toProfile);
  const washer = base.find(p => p.id === wash_then_dry.washer_id);
  const dryer = base.find(p => p.id === wash_then_dry.dryer_id);

  if (!washer || !dryer) {
    throw new Error('eink.appliance_schedule.wash_then_dry references an unknown appliance id');
  }

  return [...base, composeProfiles('wash_then_dry', wash_then_dry.label, [washer, dryer], transfer_gap_minutes)];
}
