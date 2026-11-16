import { Device } from '../../../models';
import { EnergyMonitorCapability } from '../../../models/capabilities';
import { TimeRangeSelector } from '../../../models/capabilities/helpers';
import { Request, Response, NextFunction } from 'express';
import dayjs from '../../../dayjs';
import {
  BooleanEventApiResponse,
  EnumEventApiResponse,
  HistoryDetailsApiResponse,
  NumericEventApiResponse
} from '../../../api/types';
import { mapBooleanHistoryToResponse, mapNumericHistoryToResponse, mapStringHistoryToResponse, bucketByDay, daysInRange, dailyUnitRate } from '../history-helpers';
import { PriceSlot } from '../../../helpers/prices';

// Types

export type HistoryLineResponse = {
  data: HistoryDetailsApiResponse<NumericEventApiResponse>;
  label: string;
  yAxisID?: string;
  period?: 'day' | 'month';
  filled?: boolean;
};

export type HistoryModeDetail = {
  value: string | true;
  label: string;
  fillColor?: string;
};

export type HistoryModesResponse = {
  data: HistoryDetailsApiResponse<EnumEventApiResponse | BooleanEventApiResponse>;
  details: HistoryModeDetail[];
};

export type HistoryBarResponse = {
  data: HistoryDetailsApiResponse<NumericEventApiResponse>;
  label: string;
  yAxisID?: string;
  period: 'day' | 'month';
};

export type HistoryMarkerResponse = {
  at: string;
  label?: string;
  color: string;
};

export type HistoryResponse = {
  lines: HistoryLineResponse[];
  modes?: HistoryModesResponse[];
  bars?: HistoryBarResponse[];
  markers?: HistoryMarkerResponse[];
};

type HistoryFetcher = (device: Device, selector: TimeRangeSelector, instanceId: string | null) => Promise<HistoryResponse>;

// Helpers

type AwaitedObject<T> = {
  [K in keyof T]: T[K] extends Promise<infer U> ? U : T[K];
};

async function awaitPromises<T extends Record<string, unknown>>(obj: T): Promise<AwaitedObject<T>> {
  const entries = await Promise.all(
    Object.entries(obj).map(async ([key, value]) => [key, await value])
  );

  return Object.fromEntries(entries) as AwaitedObject<T>;
}

function energyBars(energyMonitor: EnergyMonitorCapability, selector: TimeRangeSelector): Promise<HistoryBarResponse[]> {
  return mapNumericHistoryToResponse((hs) => energyMonitor.getDayEnergyHistory(hs), selector)
    .then(data => [{ data, label: 'Energy (kWh)', yAxisID: 'yEnergy', period: 'day' as const }]);
}

const ACTUAL_RUN_COLOR = 'rgba(46, 204, 113, 0.35)';
const PLANNED_RUN_COLOR = 'rgba(46, 204, 113, 0.15)';

const FORECAST_HORIZON_DAYS = 7;

function slotToEvent(slot: PriceSlot): NumericEventApiResponse {
  return {
    start: slot.start.toISOString(),
    end: slot.end.toISOString(),
    lastReported: slot.start.toISOString(),
    value: slot.pence,
  };
}

function blocksToModeData(blocks: { start: string; end: string }[], selector: TimeRangeSelector): HistoryDetailsApiResponse<BooleanEventApiResponse> {
  return {
    since: selector.since.toISOString(),
    until: selector.until.toISOString(),
    history: blocks.map(b => ({ start: b.start, end: b.end, lastReported: b.end, value: true })),
  };
}

// A graph's lines must share since/until, so this widens to the view without
// letting the ongoing reading run on past now.
function stopAtNow(data: HistoryDetailsApiResponse<NumericEventApiResponse>, view: TimeRangeSelector): HistoryDetailsApiResponse<NumericEventApiResponse> {
  return {
    since: data.since,
    until: view.until.toISOString(),
    history: data.history.map((event) => ({ ...event, end: event.end ?? data.until })),
  };
}

// The unit rate as a line - published prices, then forecast once those run out -
// alongside a device's own series, split at now into actual and planned.
async function priceSchedule(
  requested: TimeRangeSelector,
  rateAxisID: string,
  getDeviceSeries: (actual: TimeRangeSelector, view: TimeRangeSelector) => Promise<Required<Pick<HistoryResponse, 'lines' | 'modes'>>>
): Promise<HistoryResponse> {
  const now = new Date();
  const until = new Date(Math.min(requested.until.getTime(), dayjs(now).add(FORECAST_HORIZON_DAYS, 'day').valueOf()));
  const [costDevice] = await Device.findByCapability('ENERGY_COST');
  const energyCost = costDevice.getEnergyCostCapability();
  const latestRate = await energyCost.getUnitRateEvent();
  const publishedUntil = latestRate
    ? new Date(Math.max(now.getTime(), dayjs(latestRate.start).add(30, 'minute').valueOf()))
    : now;

  const forecastSlots = until > publishedUntil
    ? (await energyCost.getForwardUnitRates(until)).filter((slot) => slot.isEstimated)
    : [];

  const rateSelector = { since: requested.since, until: new Date(Math.min(until.getTime(), publishedUntil.getTime())) };
  const actualSelector = { since: requested.since, until: new Date(Math.min(until.getTime(), now.getTime())) };
  const [rateData, deviceSeries] = await Promise.all([
    mapNumericHistoryToResponse((hs) => energyCost.getUnitRateHistory(hs), rateSelector),
    getDeviceSeries(actualSelector, { since: requested.since, until })
  ]);

  rateData.history = [...rateData.history, ...forecastSlots.map(slotToEvent)];
  rateData.until = until.toISOString();

  return {
    lines: [...deviceSeries.lines, { data: rateData, label: 'Unit rate (p/kWh)', yAxisID: rateAxisID }],
    modes: deviceSeries.modes,
    markers: [
      ...(until >= now ? [{ at: now.toISOString(), label: 'Now', color: '#fa5252' }] : []),
      ...(forecastSlots.length > 0 ? [{ at: publishedUntil.toISOString(), label: 'Forecast', color: '#868e96' }] : []),
    ],
  };
}

// Registry

const historyFetchers = new Map<string, HistoryFetcher>([
  // Heat Pump - Power (Yield + Power with modes), with the unit rate and planned hot water window
  ['heatpump-power', (device, selector) => priceSchedule(selector, 'yRate', async (actual, view) => {
    const heatPump = device.getHeatPumpCapability();
    const dhwWindow = heatPump.getPlannedDHWWindow();
    const [yieldData, powerData, modeData] = await Promise.all([
      mapNumericHistoryToResponse((hs) => heatPump.getCurrentYieldHistory(hs), actual),
      mapNumericHistoryToResponse((hs) => heatPump.getCurrentPowerHistory(hs), actual),
      mapStringHistoryToResponse((hs) => heatPump.getModeHistory(hs), actual)
    ]);

    return {
      lines: [
        { data: stopAtNow(yieldData, view), label: 'Yield' },
        { data: stopAtNow(powerData, view), label: 'Power' }
      ],
      modes: [
        {
          data: modeData,
          details: [
            { value: 'HEATING', label: 'Heating' },
            { value: 'DEICING', label: 'Deicing' },
            { value: 'FROST_PROTECTION', label: 'Frost Protection' },
            { value: 'DHW', label: 'Hot Water' }
          ]
        },
        {
          data: blocksToModeData(dhwWindow ? [dhwWindow] : [], view),
          details: [{ value: true as const, label: 'Hot Water (planned)', fillColor: PLANNED_RUN_COLOR }]
        }
      ]
    };
  })],

  // Heat Pump - Compressor Modulation
  ['heatpump-compressor-modulation', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getCompressorModulationHistory(hs), selector),
          label: 'Compressor Modulation (%)'
        }
      ]
    };
  }],

  // Heat Pump - Cumulative Energy (per-day running totals stored every 15 min)
  ['heatpump-cumulative-energy', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: await Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayCumulativePowerHistory(hs), selector)
          .then(data => ({ data, label: 'Total Power (kWh)' })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayHeatingCumulativePowerHistory(hs), selector)
          .then(data => ({ data, label: 'Heating Power (kWh)' })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayDHWCumulativePowerHistory(hs), selector)
          .then(data => ({ data, label: 'DHW Power (kWh)' })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayCumulativeYieldHistory(hs), selector)
          .then(data => ({ data, label: 'Total Yield (kWh)' })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayHeatingCumulativeYieldHistory(hs), selector)
          .then(data => ({ data, label: 'Heating Yield (kWh)' })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayDHWCumulativeYieldHistory(hs), selector)
          .then(data => ({ data, label: 'DHW Yield (kWh)' })),
      ])
    };
  }],

  // Heat Pump - Outside Temperature
  ['heatpump-outside-temp', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getOutsideTemperatureHistory(hs), selector),
          label: 'Outside Temperature'
        }
      ]
    };
  }],

  // Heat Pump - DHW Temperature
  ['heatpump-dhw-temp', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getDHWTemperatureHistory(hs), selector),
          label: 'Hot Water Temperature'
        }
      ]
    };
  }],

  // Heat Pump - Flow Temperature (Flow + Return)
  ['heatpump-flow-temp', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: await Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getActualFlowTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Actual Flow Temperature' })),
        mapNumericHistoryToResponse((hs) => heatPump.getReturnTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Return Temperature' }))
      ])
    };
  }],

  // Heat Pump - System Pressure
  ['heatpump-pressure', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => heatPump.getSystemPressureHistory(hs), selector),
          label: 'System Pressure'
        }
      ]
    };
  }],

  // Heat Pump - Daily Overall Metrics (CoP bar, Power/Yield lines)
  ['heatpump-daily-metrics', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return awaitPromises({
      bars: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayCoPHistory(hs), selector)
          .then(data => ({ data, label: 'CoP', yAxisID: 'yCoP', period: 'day' as const }))
      ]),
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayPowerHistory(hs), selector)
          .then(data => ({ data, label: 'Power (kWh)', yAxisID: 'yEnergy', period: 'day' as const })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayYieldHistory(hs), selector)
          .then(data => ({ data, label: 'Yield (kWh)', yAxisID: 'yEnergy', period: 'day' as const }))
      ])
    });
  }],

  // Heat Pump - Daily Heating Metrics (CoP bar, Power/Yield lines)
  ['heatpump-daily-heating', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return awaitPromises({
      bars: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayHeatingCoPHistory(hs), selector)
          .then(data => ({ data, label: 'Heating CoP', yAxisID: 'yCoP', period: 'day' as const }))
      ]),
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayHeatingPowerHistory(hs), selector)
          .then(data => ({ data, label: 'Heating Power (kWh)', yAxisID: 'yEnergy', period: 'day' as const })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayHeatingYieldHistory(hs), selector)
          .then(data => ({ data, label: 'Heating Yield (kWh)', yAxisID: 'yEnergy', period: 'day' as const }))
      ])
    });
  }],

  // Heat Pump - Daily DHW Metrics (CoP bar, Power/Yield lines)
  ['heatpump-daily-dhw', async (device, selector) => {
    const heatPump = device.getHeatPumpCapability();

    return awaitPromises({
      bars: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayDHWCoPHistory(hs), selector)
          .then(data => ({ data, label: 'DHW CoP', yAxisID: 'yCoP', period: 'day' as const }))
      ]),
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => heatPump.getDayDHWPowerHistory(hs), selector)
          .then(data => ({ data, label: 'DHW Power (kWh)', yAxisID: 'yEnergy', period: 'day' as const })),
        mapNumericHistoryToResponse((hs) => heatPump.getDayDHWYieldHistory(hs), selector)
          .then(data => ({ data, label: 'DHW Yield (kWh)', yAxisID: 'yEnergy', period: 'day' as const }))
      ])
    });
  }],

  // Thermostat
  ['thermostat', async (device, selector) => {
    const thermostat = device.getThermostatCapability();

    return awaitPromises({
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Current Temperature', yAxisID: 'yTemperature' })),
        mapNumericHistoryToResponse((hs) => thermostat.getTargetTemperatureHistory(hs), selector)
          .then(data => ({ data, label: 'Target Temperature', yAxisID: 'yTemperature' })),
        mapNumericHistoryToResponse((hs) => thermostat.getPowerHistory(hs), selector)
          .then(data => ({ data, label: 'Power', yAxisID: 'yPercentage', filled: true }))
      ])
    });
  }],

  // Light
  ['light', async (device, selector) => {
    const light = device.getLightCapability();

    return awaitPromises({
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => light.getBrightnessHistory(hs), selector)
          .then(data => ({ data, label: 'Brightness' }))
      ]),
      modes: mapBooleanHistoryToResponse((hs) => light.getIsOnHistory(hs), selector)
        .then(data => [{
          data,
          details: [
            { value: true as const, label: 'On', fillColor: 'rgba(255, 165, 0, 0.3)' }
          ]
        }])
    });
  }],

  // Electric Vehicle - Charge, with the unit rate and actual/planned charge windows
  ['vehicle-charge', (device, selector) => priceSchedule(selector, 'yRate', async (actual, view) => {
    const ev = device.getElectricVehicleCapability();
    const [charge, charging] = await Promise.all([
      mapNumericHistoryToResponse((hs) => ev.getChargePercentageHistory(hs), actual),
      mapBooleanHistoryToResponse((hs) => ev.getIsChargingHistory(hs), actual)
    ]);

    return {
      lines: [{ data: stopAtNow(charge, view), label: 'Charge %' }],
      modes: [
        { data: charging, details: [{ value: true as const, label: 'Charging', fillColor: ACTUAL_RUN_COLOR }] },
        { data: blocksToModeData(ev.getPlannedChargeBlocks(), view), details: [{ value: true as const, label: 'Charging (planned)', fillColor: PLANNED_RUN_COLOR }] }
      ]
    };
  })],

  // Alarm Sensor (input/dry-contact, e.g. fire alarm relay)
  ['alarm-sensor', async (device, selector) => {
    const sensor = device.getAlarmSensorCapability();

    return {
      lines: [],
      modes: await mapBooleanHistoryToResponse((hs) => sensor.getIsTriggeredHistory(hs), selector)
        .then(data => [{
          data,
          details: [
            { value: true as const, label: 'Triggered', fillColor: 'rgba(231, 76, 60, 0.35)' }
          ]
        }])
    };
  }],

  // Electric Vehicle - Monthly Mileage & Efficiency
  ['vehicle-monthly-mileage', async (device, selector) => {
    const ev = device.getElectricVehicleCapability();

    return awaitPromises({
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => ev.getMonthlyEfficiencyHistory(hs), selector)
          .then(data => ({ data, label: 'Efficiency (mi/kWh)', yAxisID: 'yEfficiency', period: 'month' as const }))
      ]),
      bars: Promise.all([
        mapNumericHistoryToResponse((hs) => ev.getMonthlyMileageHistory(hs), selector)
          .then(data => ({ data, label: 'Monthly Mileage (mi)', yAxisID: 'y', period: 'month' as const }))
      ])
    });
  }],

  // Energy Monitor - Power
  ['energy-power', async (device, selector, instanceId) => {
    const energyMonitor = device.getEnergyMonitorCapability(instanceId);

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => energyMonitor.getCurrentPowerHistory(hs), selector),
          label: 'Power (W)'
        }
      ]
    };
  }],

  // Energy Monitor - Daily Energy & Cost
  ['energy-daily', async (device, selector, instanceId) => {
    const energyMonitor = device.getEnergyMonitorCapability(instanceId);

    return awaitPromises({
      bars: energyBars(energyMonitor, selector),
      lines: Promise.all([
        mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector, (v) => v / 100)
          .then(data => ({ data, label: 'Cost (£)', yAxisID: 'yCost', period: 'day' as const }))
      ])
    });
  }],

  // Energy Monitor - Effective Unit Rate (p/kWh per day = day cost / day energy)
  ['energy-unit-rate-daily', async (device, selector, instanceId) => {
    const energyMonitor = device.getEnergyMonitorCapability(instanceId);
    const [bars, costPenceByDay, energyByDay] = await Promise.all([
      energyBars(energyMonitor, selector),
      mapNumericHistoryToResponse((hs) => energyMonitor.getDayCostHistory(hs), selector).then(bucketByDay),
      mapNumericHistoryToResponse((hs) => energyMonitor.getDayEnergyHistory(hs), selector).then(bucketByDay)
    ]);

    const days = daysInRange(selector.since, selector.until);

    return {
      bars,
      lines: [{
        data: dailyUnitRate(costPenceByDay, energyByDay, days, selector.since.toISOString(), selector.until.toISOString()),
        label: 'Unit rate (p/kWh)', yAxisID: 'yRate', period: 'day' as const
      }]
    };
  }],

  // Energy Cost - Unit Rate
  ['energy-unit-rate', async (device, selector) => {
    const energyCost = device.getEnergyCostCapability();

    return {
      lines: [
        {
          data: await mapNumericHistoryToResponse((hs) => energyCost.getUnitRateHistory(hs), selector),
          label: 'Unit Rate (p/kWh)'
        }
      ]
    };
  }]
]);

// Route handler

export default async function (req: Request<{ id: string }>, res: Response, next: NextFunction) {
  const graphId = req.query.id as string | undefined;
  const instanceId = (req.query.instance as string | undefined) ?? null;

  if (!graphId) {
    return res.status(400).json({ error: 'Missing required query parameter: id' });
  }

  const fetcher = historyFetchers.get(graphId);

  if (!fetcher) {
    return res.status(400).json({ error: `Unknown graph id: ${graphId}` });
  }

  const device = await Device.findById(req.params.id);

  if (!device) {
    return next('route');
  }

  const sinceParam = req.query.since as string | undefined;
  const untilParam = req.query.until as string | undefined;

  const historySelector = {
    since: sinceParam ? new Date(sinceParam) : dayjs().startOf('day').toDate(),
    until: untilParam ? new Date(untilParam) : new Date()
  };

  const response = await fetcher(device, historySelector, instanceId);
  res.json(response);
}
