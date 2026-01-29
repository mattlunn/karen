import { Device, NumericEvent } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';
import setIntervalForTime from '../../helpers/set-interval-for-time';
import { dayjs } from '../../dayjs';
import { clampAndSortHistory } from '../../helpers/history';

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

    updateState(() => client.getEnergyDaily(), (v) => deviceCapability.setDailyConsumedEnergyState(v)),
    updateState(() => client.getCurrentPower(), (v) => deviceCapability.setCurrentPowerState(roundTo1DecimalPlace(v))),
    updateState(() => client.getCurrentYield(), (v) => deviceCapability.setCurrentYieldState(roundTo1DecimalPlace(v))),
    updateState(() => client.getMode(), (v) => deviceCapability.setModeState(v)),
    updateState(() => client.getCopHwc(), (v) => deviceCapability.setDHWCoPState(v)),
    updateState(() => client.getCopHc(), (v) => deviceCapability.setHeatingCoPState(v)),
    updateState(() => client.getDHWIsOn(), (v) => deviceCapability.setDHWIsOnState(v))
  ]);
}), Math.max(config.ebusd.poll_interval_minutes, 1) * 60 * 1000);

setIntervalForTime(async () => {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const capability = await device.getHeatPumpCapability();
  const endOfDay = dayjs().toDate();
  const startOfDay = dayjs(endOfDay).subtract(1, 'd').toDate();

  function dailyWattHours(events: NumericEvent[]) {
    return events.reduce((acc, curr) => {
      return acc + (curr.value * dayjs(curr.end).diff(curr.start, 'minute'));
    }, 0) / 60;
  }

  const dayPower = dailyWattHours(clampAndSortHistory(await capability.getCurrentPowerHistory({ since: startOfDay, until: endOfDay }), startOfDay, endOfDay, false));
  const dayYield = dailyWattHours(clampAndSortHistory(await capability.getCurrentYieldHistory({ since: startOfDay, until: endOfDay }), startOfDay, endOfDay, false));

  const calculatedCoP = (dayPower + dayYield) / dayPower;

  await capability.setDayCoPState(calculatedCoP, endOfDay);
  console.log(`Calculated CoP is ${calculatedCoP.toFixed(1)} (dayPower: ${dayPower}, dayYield: ${dayYield}) for ${dayjs(startOfDay).format('DD/MM/YYYY')}`);
}, '00:00');