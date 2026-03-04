import type { SmartcarSignalAttributes, SmartcarSuccessSignalAttributes } from 'smartcar';
import { ElectricVehicleCapability } from '../../models/capabilities/capabilities.gen';
import logger from '../../logger';

const KM_TO_MILES = 0.621371;

function isSuccessSignal(signal: SmartcarSignalAttributes): signal is SmartcarSuccessSignalAttributes {
  return signal.status.value === 'SUCCESS';
}

export async function processSignal(
  ev: ElectricVehicleCapability,
  signal: SmartcarSignalAttributes
): Promise<void> {
  if (!isSuccessSignal(signal)) {
    return;
  }

  logger.info(`Processing an update for signal ${signal.code}. ${JSON.stringify(signal.body)}`);

  switch (signal.code) {
    case 'tractionbattery-stateofcharge':
      await ev.setChargePercentageState(signal.body.value);
      break;
    case 'charge-ischarging':
      await ev.setIsChargingState(signal.body.value);
      break;
    case 'odometer-traveleddistance':
      await ev.setOdometerState(signal.body.value * KM_TO_MILES);
      break;
    default:
      logger.debug({ code: signal.code }, 'Unrecognized signal code');
      break;
  }
}
