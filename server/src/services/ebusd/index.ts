import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';
import { storeRunningMetrics } from './history';

Device.registerProvider('ebusd', {
  getCapabilities(device) {
    return ['HEAT_PUMP', 'ENERGY_MONITOR', 'CONNECTIVITY'];
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
  const heatPumpCapability = device.getHeatPumpCapability();
  const energyMonitorCapability = device.getEnergyMonitorCapability();

  async function updateState<T>(getter: () => Promise<T>, updater: (value: T) => Promise<unknown>) {
    await updater(await getter());
  }

  function roundTo1DecimalPlace(val: number) {
    return Math.round(val * 10) / 10;
  }

  const results = await Promise.allSettled([
    updateState(() => client.getOutsideTemperature(), (v) => heatPumpCapability.setOutsideTemperatureState(roundTo1DecimalPlace(v))),

    updateState(() => client.getActualFlowTemperature(), (v) => heatPumpCapability.setActualFlowTemperatureState(roundTo1DecimalPlace(v))),
    updateState(() => client.getDesiredFlowTemperature(), (v) => heatPumpCapability.setDesiredFlowTemperatureState(roundTo1DecimalPlace(v))),
    updateState(() => client.getReturnTemperature(), (v) => heatPumpCapability.setReturnTemperatureState(roundTo1DecimalPlace(v))),

    updateState(() => client.getCompressorPower(), (v) => heatPumpCapability.setCompressorPowerState(v)),
    updateState(() => client.getCompressorModulation(), (v) => heatPumpCapability.setCompressorModulationState(v)),

    updateState(() => client.getHotWaterCylinderTemperature(), (v) => heatPumpCapability.setDHWTemperatureState(v)),
    updateState(() => client.getSystemPressure(), (v) => heatPumpCapability.setSystemPressureState(v)),

    updateState(() => client.getCurrentPower(), (v) => Promise.all([
      heatPumpCapability.setCurrentPowerState(roundTo1DecimalPlace(v)),
      energyMonitorCapability.setCurrentPowerState(roundTo1DecimalPlace(v))
    ])),
    updateState(() => client.getCurrentYield(), (v) => heatPumpCapability.setCurrentYieldState(roundTo1DecimalPlace(v))),
    updateState(() => client.getMode(), (v) => heatPumpCapability.setModeState(v)),
    updateState(() => client.getDHWIsOn(), (v) => heatPumpCapability.setDHWIsOnState(v))
  ]);

  const anySucceeded = results.some(r => r.status === 'fulfilled');
  const failures = results.filter(r => r.status === 'rejected');

  await device.getConnectivityCapability().setIsConnectedState(anySucceeded);

  if (failures.length > 0) {
    throw failures[0].reason;
  }
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);

nowAndSetInterval(createBackgroundTransaction('ebusd:daily-metrics', async () => {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  await storeRunningMetrics(device, device.getHeatPumpCapability());
}), 15 * 60 * 1000);