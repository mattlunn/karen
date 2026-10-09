import type { BridgeVehicle } from './types';
import { Device } from '../../models';
import { ElectricVehicleCapability } from '../../models/capabilities';
import config from '../../config';
import { distanceInMetres } from '../../helpers/geo';

const KM_TO_MILES = 0.621371;
const HOME_RADIUS_METRES = 200;

// Treated as home until the first location report says otherwise.
export async function isAtHome(ev: ElectricVehicleCapability): Promise<boolean> {
  const event = await ev.getIsAtHomeEvent();

  return event === null || !event.hasEnded();
}

// Charging elsewhere is on someone else's meter, so it isn't this house's load.
async function updateCurrentPower(device: Device): Promise<void> {
  const ev = device.getElectricVehicleCapability();
  const [isCharging, atHome] = await Promise.all([ev.getIsCharging(), isAtHome(ev)]);

  await device.getEnergyMonitorCapability().setCurrentPowerState(
    isCharging && atHome ? config.vehicle.charge_power_watts : 0
  );
}

export async function processVehicle(device: Device, vehicle: BridgeVehicle): Promise<void> {
  const ev = device.getElectricVehicleCapability();

  if (vehicle.ev_battery_percentage !== null) {
    await ev.setChargePercentageState(vehicle.ev_battery_percentage);
  }

  if (vehicle.ev_battery_is_charging !== null) {
    await ev.setIsChargingState(vehicle.ev_battery_is_charging);
  }

  if (vehicle.ev_battery_is_plugged_in !== null) {
    await ev.setIsCableConnectedState(Boolean(vehicle.ev_battery_is_plugged_in));
  }

  if (vehicle.ev_charge_limits_ac !== null) {
    await ev.setChargeLimitState(vehicle.ev_charge_limits_ac);
  }

  if (vehicle.odometer !== null) {
    await ev.setOdometerState(vehicle.odometer_unit === 'km' ? vehicle.odometer * KM_TO_MILES : vehicle.odometer);
  }

  if (vehicle.location_latitude !== null && vehicle.location_longitude !== null) {
    const location = { latitude: vehicle.location_latitude, longitude: vehicle.location_longitude };

    await ev.setIsAtHomeState(distanceInMetres(location, config.location) <= HOME_RADIUS_METRES);
  }

  await updateCurrentPower(device);
}
