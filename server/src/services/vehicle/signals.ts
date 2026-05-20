import type { SmartcarSignalAttributes, SmartcarSuccessSignalAttributes } from 'smartcar';
import { Device } from '../../models';
import config from '../../config';
import logger from '../../logger';

const KM_TO_MILES = 0.621371;

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
    case 'charge-ischarging': {
      const isCharging = signal.body.value;

      await ev.setIsChargingState(isCharging);
      await device.getEnergyMonitorCapability().setCurrentPowerState(
        isCharging ? config.smartcar.charge_power_watts : 0
      );
    }
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
