import type { SmartcarSignal } from 'smartcar';
import { ElectricVehicleCapability } from '../../models/capabilities/capabilities.gen';
import logger from '../../logger';

const KM_TO_MILES = 0.621371;

export async function processSignal(
  ev: ElectricVehicleCapability,
  signal: SmartcarSignal['attributes']
): Promise<void> {
  if (signal.status.value !== 'SUCCESS' || !signal.body) {
    return;
  }

  logger.info(`Processing an update for signal ${signal.code}. ${JSON.stringify(signal.body)}`);

  switch (signal.code) {
    case 'tractionbattery-stateofcharge':
      await ev.setChargePercentageState((signal.body as { value: number }).value);
      break;
    case 'charge-ischarging':
      await ev.setIsChargingState((signal.body as { value: boolean }).value);
      break;
    case 'odometer-traveleddistance':
      await ev.setOdometerState((signal.body as { value: number }).value * KM_TO_MILES);
      break;
    default:
      logger.debug({ code: signal.code }, 'Unrecognized signal code');
      break;
  }
}
