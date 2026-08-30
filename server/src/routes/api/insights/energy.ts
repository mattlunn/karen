import { Device } from '../../../models';
import { Request, Response } from 'express';
import {
  EnergyInsightsSeriesApiResponse,
  EnergyScheduleApiResponse,
  HistoryModesApiResponse,
  BooleanEventApiResponse,
  HistoryDetailsApiResponse,
} from '../../../api/types';
import { mapNumericHistoryToResponse, mapBooleanHistoryToResponse } from '../history-helpers';
import { asyncMap } from '../../../helpers/array';
import { getDHWStatus } from '../../../services/ebusd/dhw';
import { getPlannedChargeBlocks } from '../../../services/vehicle';

const EV_ACTUAL_COLOR = 'rgba(46, 204, 113, 0.35)';
const EV_PLANNED_COLOR = 'rgba(46, 204, 113, 0.15)';
const DHW_ACTUAL_COLOR = 'rgba(52, 152, 219, 0.35)';
const DHW_PLANNED_COLOR = 'rgba(52, 152, 219, 0.15)';

function blocksToModeData(
  blocks: { start: string; end: string }[],
  since: Date,
  until: Date
): HistoryDetailsApiResponse<BooleanEventApiResponse> {
  return {
    since: since.toISOString(),
    until: until.toISOString(),
    history: blocks.map(b => ({ start: b.start, end: b.end, lastReported: b.end, value: true })),
  };
}

export async function scheduleHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string),
  };

  const [costDevice] = await Device.findByCapability('ENERGY_COST');
  const [evDevice] = await Device.findByCapability('ELECTRIC_VEHICLE');
  const [heatPumpDevice] = await Device.findByCapability('HEAT_PUMP');

  const lines = costDevice
    ? [{
      data: await mapNumericHistoryToResponse(
        (hs) => costDevice.getEnergyCostCapability().getUnitRateHistory(hs),
        selector
      ),
      label: 'Unit rate (p/kWh)',
      yAxisID: 'yRate',
    }]
    : [];

  const modes: HistoryModesApiResponse[] = [];

  if (evDevice) {
    const ev = evDevice.getElectricVehicleCapability();

    modes.push({
      data: await mapBooleanHistoryToResponse((hs) => ev.getIsChargingHistory(hs), selector),
      details: [{ value: true, label: 'EV charging', fillColor: EV_ACTUAL_COLOR }],
    });
  }

  modes.push({
    data: blocksToModeData(getPlannedChargeBlocks(), selector.since, selector.until),
    details: [{ value: true, label: 'EV charging (planned)', fillColor: EV_PLANNED_COLOR }],
  });

  if (heatPumpDevice) {
    const heatPump = heatPumpDevice.getHeatPumpCapability();

    modes.push({
      data: await mapBooleanHistoryToResponse((hs) => heatPump.getDHWIsOnHistory(hs), selector),
      details: [{ value: true, label: 'Hot water', fillColor: DHW_ACTUAL_COLOR }],
    });
  }

  const dhwSchedule = (await getDHWStatus().catch(() => null))?.schedule ?? null;

  modes.push({
    data: blocksToModeData(dhwSchedule ? [dhwSchedule] : [], selector.since, selector.until),
    details: [{ value: true, label: 'Hot water (planned)', fillColor: DHW_PLANNED_COLOR }],
  });

  res.json({ lines, modes } satisfies EnergyScheduleApiResponse);
}

export async function usageHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  res.json({
    series: await asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), selector),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    })
  } satisfies EnergyInsightsSeriesApiResponse);
}

export async function costHandler(req: Request, res: Response) {
  const selector = {
    since: new Date(req.query.since as string),
    until: new Date(req.query.until as string)
  };

  const devices = await Device.findByCapability('ENERGY_MONITOR');

  res.json({
    series: await asyncMap(devices, async (device) => {
      const energyMonitor = device.getEnergyMonitorCapability();

      return {
        data: await mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector, (v) => v / 100),
        label: device.name,
        deviceId: device.id,
        deviceName: device.name
      };
    })
  } satisfies EnergyInsightsSeriesApiResponse);
}
