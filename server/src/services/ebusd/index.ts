import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';
import { storeRunningMetrics } from './history';

Device.registerProvider('ebusd', {
  getCapabilities(device) {
    return ['HEAT_PUMP'];
  },

  async synchronize() {
    let device = await Device.findByProviderId('ebusd', 'heatpump');

    if (device === null) {
      device = Device.build({
        provider: 'ebusd',
        providerId: 'heatpump',
        name: 'Heat Pump',
      });
    }

    device.manufacturer = 'Vaillant';
    device.model = 'aroTHERM Plus';

    await device.save();
  }
});

export async function setDHWMode(isOn: boolean) {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  await client.setIsDHWOn(isOn);
}

export async function getDHWMode(): Promise<boolean> {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  return device.getHeatPumpCapability().getDHWIsOn();
}

nowAndSetInterval(createBackgroundTransaction('ebusd:poll', async () => {
  const client = new EbusClient(config.ebusd.host, config.ebusd.port);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const deviceCapability = device.getHeatPumpCapability();
  
  async function updateState<T>(getter: () => Promise<T>, updater: (value: T) => Promise<unknown>) {
    await updater(await getter());
  }

  function roundTo1DecimalPlace(val: number) {
    return Math.round(val * 10) / 10;
  }

  await Promise.all([
    updateState(() => client.getOutsideTemperature(), (v) => deviceCapability.setOutsideTemperatureState(roundTo1DecimalPlace(v))),

    updateState(() => client.getActualFlowTemperature(), (v) => deviceCapability.setActualFlowTemperatureState(roundTo1DecimalPlace(v))),
    updateState(() => client.getDesiredFlowTemperature(), (v) => deviceCapability.setDesiredFlowTemperatureState(roundTo1DecimalPlace(v))),
    updateState(() => client.getReturnTemperature(), (v) => deviceCapability.setReturnTemperatureState(roundTo1DecimalPlace(v))),

    updateState(() => client.getCompressorPower(), (v) => deviceCapability.setCompressorPowerState(v)),
    updateState(() => client.getCompressorModulation(), (v) => deviceCapability.setCompressorModulationState(v)),

    updateState(() => client.getHotWaterCylinderTemperature(), (v) => deviceCapability.setDHWTemperatureState(v)),
    updateState(() => client.getSystemPressure(), (v) => deviceCapability.setSystemPressureState(v)),

    updateState(() => client.getCurrentPower(), (v) => deviceCapability.setCurrentPowerState(roundTo1DecimalPlace(v))),
    updateState(() => client.getCurrentYield(), (v) => deviceCapability.setCurrentYieldState(roundTo1DecimalPlace(v))),
    updateState(() => client.getMode(), (v) => deviceCapability.setModeState(v)),
    updateState(() => client.getDHWIsOn(), (v) => deviceCapability.setDHWIsOnState(v))
  ]);
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);

nowAndSetInterval(createBackgroundTransaction('ebusd:daily-metrics', async () => {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  await storeRunningMetrics(device, device.getHeatPumpCapability());
}), 15 * 60 * 1000);