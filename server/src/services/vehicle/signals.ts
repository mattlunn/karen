import type { SmartcarSignalAttributes, SmartcarSuccessSignalAttributes } from './types';
import { Device } from '../../models';
import { ElectricVehicleCapability } from '../../models/capabilities';
import config from '../../config/app';
import { distanceInMetres } from '../../helpers/geo';
import logger from '../../logger';

const KM_TO_MILES = 0.621371;
const HOME_RADIUS_METRES = 200;

// Treated as home until the first location signal says otherwise.
export async function isAtHome(ev: ElectricVehicleCapability): Promise<boolean> {
  const event = await ev.getIsAtHomeEvent();

  return event === null || !event.hasEnded();
}

// Charging elsewhere is on someone else's meter, so it isn't this house's load.
async function updateCurrentPower(device: Device): Promise<void> {
  const ev = device.getElectricVehicleCapability();
  const [isCharging, atHome] = await Promise.all([ev.getIsCharging(), isAtHome(ev)]);

  await device.getEnergyMonitorCapability().setCurrentPowerState(
    isCharging && atHome ? config.smartcar.charge_power_watts : 0
  );
}

function isSuccessSignal(signal: SmartcarSignalAttributes): signal is SmartcarSuccessSignalAttributes {
  return signal.status.value === 'SUCCESS';
}

export async function processSignal(
  device: Device,
  signal: SmartcarSignalAttributes
): Promise<void> {
  logger.info(`Processing an update for signal ${signal.code}. ${JSON.stringify(signal.status)}`);

  if (!isSuccessSignal(signal)) {
    return;
  }

  logger.info(`Processing an update for signal ${signal.code}. ${JSON.stringify(signal.body)}`);

  const ev = device.getElectricVehicleCapability();

  switch (signal.code) {
    case 'tractionbattery-stateofcharge':
      await ev.setChargePercentageState(signal.body.value);
      break;
    case 'charge-ischarging':
      await ev.setIsChargingState(signal.body.value);
      await updateCurrentPower(device);
      break;
    case 'location-preciselocation':
      await ev.setIsAtHomeState(distanceInMetres(signal.body, config.location) <= HOME_RADIUS_METRES);
      await updateCurrentPower(device);
      break;
    case 'charge-ischargingcableconnected':
      await ev.setIsCableConnectedState(signal.body.value);
      break;
    case 'odometer-traveleddistance':
      await ev.setOdometerState(signal.body.value * KM_TO_MILES);
      break;
    default:
      logger.debug({ code: signal.code }, 'Unrecognized signal code');
      break;
  }
}
