import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';

Device.registerProvider('ebusd', {
  getCapabilities(device) {
    return ['HEAT_PUMP'];
  },

  async synchronize() {
    const device = await Device.findByProviderId('ebusd', 'heatpump');

    if (device === null) {
      await Device.create({
        provider: 'ebusd',
        providerId: 'heatpump',
        name: 'Heat Pump',
        type: 'heatpump'
      });
    }
  }
});

export async function setDHWMode(isOn: true) {
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

  await Promise.all([
    updateState(() => client.getOutsideTemperature(), (v) => deviceCapability.setOutsideTemperatureState(v)),
    updateState(() => client.getActualFlowTemperature(), (v) => deviceCapability.setActualFlowTemperatureState(v)),
    updateState(() => client.getCompressorModulation(), (v) => deviceCapability.setCompressorModulationState(v)),
    updateState(() => client.getDesiredFlowTemperature(), (v) => deviceCapability.setDesiredFlowTemperatureState(v)),
    updateState(() => client.getReturnTemperature(), (v) => deviceCapability.setReturnTemperatureState(v)),
    updateState(() => client.getHotWaterCylinderTemperature(), (v) => deviceCapability.setDHWTemperatureState(v)),
    updateState(() => client.getSystemPressure(), (v) => deviceCapability.setSystemPressureState(v)),
    updateState(() => client.getCompressorPower(), (v) => deviceCapability.setCompressorPowerState(v)),
    updateState(() => client.getEnergyDaily(), (v) => deviceCapability.setDailyConsumedEnergyState(v)),
    updateState(() => client.getCurrentPower(), (v) => deviceCapability.setCurrentPowerState(v)),
    updateState(() => client.getCurrentYield(), (v) => deviceCapability.setCurrentYieldState(v)),
    updateState(() => client.getMode(), (v) => deviceCapability.setModeState(v)),
    updateState(() => client.getCopHwc(), (v) => deviceCapability.setDHWCoPState(v)),
    updateState(() => client.getCopHc(), (v) => deviceCapability.setHeatingCoPState(v)),
    updateState(() => client.getDHWIsOn(), (v) => deviceCapability.setDHWIsOnState(v))
  ]);
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);