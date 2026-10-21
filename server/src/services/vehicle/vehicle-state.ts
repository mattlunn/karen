import type { BridgeVehicle } from './types';
import { Device } from '../../models';
import { ElectricVehicleCapability } from '../../models/capabilities';
import config from '../../config';
import { distanceInMetres } from '../../helpers/geo';
import { getPreconditioningMode } from './preconditioning';
import dayjs from '../../dayjs';

const KM_TO_MILES = 0.621371;
const HOME_RADIUS_METRES = 200;

// Treated as home until the first location report says otherwise.
export async function isAtHome(ev: ElectricVehicleCapability): Promise<boolean> {
  const event = await ev.getIsAtHomeEvent();

  return event === null || !event.hasEnded();
}

// Charging elsewhere is on someone else's meter, so it isn't this house's load.
async function updateCurrentPower(device: Device, now: Date, reportedAt: Date): Promise<void> {
  const ev = device.getElectricVehicleCapability();
  const [isCharging, atHome] = await Promise.all([ev.getIsCharging(), isAtHome(ev)]);

  await device.getEnergyMonitorCapability().setCurrentPowerState(
    isCharging && atHome ? config.vehicle.charge_power_watts : 0,
    now,
    reportedAt
  );
}

export async function processVehicle(device: Device, vehicle: BridgeVehicle): Promise<void> {
  const ev = device.getElectricVehicleCapability();
  const now = new Date();
  const reportedAt = vehicle.last_updated_at === null ? now : dayjs(vehicle.last_updated_at).toDate();

  if (vehicle.ev_battery_percentage !== null) {
    await ev.setChargePercentageState(vehicle.ev_battery_percentage, now, reportedAt);
  }

  if (vehicle.ev_battery_is_charging !== null) {
    await ev.setIsChargingState(vehicle.ev_battery_is_charging, now, reportedAt);
  }

  if (vehicle.ev_battery_is_plugged_in !== null) {
    await ev.setIsCableConnectedState(Boolean(vehicle.ev_battery_is_plugged_in), now, reportedAt);
  }

  if (vehicle.ev_charge_limits_ac !== null) {
    await ev.setChargeLimitState(vehicle.ev_charge_limits_ac, now, reportedAt);
  }

  if (vehicle.odometer !== null) {
    const miles = vehicle.odometer_unit === 'km' ? vehicle.odometer * KM_TO_MILES : vehicle.odometer;

    // events.value is a FLOAT, read back to ~6 significant figures, so an unrounded
    // reading never equals the stored one and every poll would start a new event.
    await ev.setOdometerState(Math.round(miles * 10) / 10, now, reportedAt);
  }

  if (vehicle.location_latitude !== null && vehicle.location_longitude !== null) {
    const location = { latitude: vehicle.location_latitude, longitude: vehicle.location_longitude };
    const locationReportedAt = vehicle.location_last_updated_at === null ? now : dayjs(vehicle.location_last_updated_at).toDate();

    await ev.setIsAtHomeState(distanceInMetres(location, config.location) <= HOME_RADIUS_METRES, now, locationReportedAt);
  }

  if (vehicle.air_control_is_on !== null) {
    const mode = getPreconditioningMode(vehicle, config.vehicle.preconditioning);

    await ev.setIsPreheatingState(mode === 'HEAT', now, reportedAt);
    await ev.setIsPrecoolingState(mode === 'COOL', now, reportedAt);
  }

  await updateCurrentPower(device, now, reportedAt);
}
