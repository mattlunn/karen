import config from '../../../../config/app';
import { ApplianceProfile, composeProfiles } from './plan';

function toProfile(a: typeof config.eink.appliance_schedule.appliances[number]): ApplianceProfile {
  return {
    id: a.id,
    label: a.label,
    fullElapsedDuration: a.cycle_minutes,
    dialCycleMinutes: a.cycle_minutes,
    powerProfileKwh: a.power_profile_kwh,
    delayMinHours: a.delay_min_hours,
    delayMaxHours: a.delay_max_hours,
  };
}

// wash-then-dry isn't itself in config.appliances - it's built by referencing two of them.
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
