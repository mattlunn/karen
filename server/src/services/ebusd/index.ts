import { Device } from '../../models';
import config from '../../config';
import nowAndSetInterval from '../../helpers/now-and-set-interval';
import { createBackgroundTransaction } from '../../helpers/newrelic';
import EbusClient from './client';
import setIntervalForTime from '../../helpers/set-interval-for-time';
import dayjs from '../../dayjs';
import { calculateDailyHeatPumpMetrics } from './aggregation';
import { HeatPumpCapability } from '../../models/capabilities';
import logger from '../../logger';

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

async function storeDailyMetrics(capability: HeatPumpCapability, startOfDay: Date, endOfDay: Date): Promise<void> {
  const metrics = await calculateDailyHeatPumpMetrics(capability, startOfDay, endOfDay);

  await Promise.all([
    capability.setDayCoPState(metrics.dayCoP, endOfDay),
    capability.setDayPowerState(metrics.dayPower, endOfDay),
    capability.setDayYieldState(metrics.dayYield, endOfDay),
    capability.setDayHeatingCoPState(metrics.heatingCoP, endOfDay),
    capability.setDayHeatingPowerState(metrics.heatingPower, endOfDay),
    capability.setDayHeatingYieldState(metrics.heatingYield, endOfDay),
    capability.setDayDHWCoPState(metrics.dhwCoP, endOfDay),
    capability.setDayDHWPowerState(metrics.dhwPower, endOfDay),
    capability.setDayDHWYieldState(metrics.dhwYield, endOfDay),
  ]);

  logger.info(`Daily metrics for ${dayjs(startOfDay).format('DD/MM/YYYY')}: CoP=${metrics.dayCoP.toFixed(1)}, HeatingCoP=${metrics.heatingCoP.toFixed(1)}, DHWCoP=${metrics.dhwCoP.toFixed(1)}`);
}

// Recalculate historic metrics on startup if configured
(async function recalculateHistoricMetrics() {
  const cutoffDate = dayjs(config.ebusd.recalculate_cutoff);
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const capability = device.getHeatPumpCapability();
  const startDate = dayjs(device.createdAt).startOf('day');
  const endDate = dayjs().startOf('day');

  logger.info(`Recalculating heat pump metrics from ${startDate.format('YYYY-MM-DD')} that were generated prior to ${cutoffDate.toISOString()}`);

  for (let day = startDate; day.isBefore(endDate); day = day.add(1, 'day')) {
    const dayStart = day.toDate();
    const dayEnd = day.add(1, 'day').toDate();

    logger.info(`Recalculating heat pump metrics for ${day.format('YYYY-MM-DD')}`);

    await storeDailyMetrics(capability, dayStart, dayEnd);
  }

  logger.info('Historic heat pump metrics recalculation complete');
})();

// Calculate daily metrics at midnight
setIntervalForTime(async () => {
  const device = await Device.findByProviderIdOrError('ebusd', 'heatpump');
  const capability = device.getHeatPumpCapability();
  const endOfDay = dayjs().toDate();
  const startOfDay = dayjs(endOfDay).subtract(1, 'd').toDate();

  await storeDailyMetrics(capability, startOfDay, endOfDay);
}, '00:00');