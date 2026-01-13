import {
  registerHistory,
  mapNumericHistoryToResponse,
  mapBooleanHistoryToResponse,
  mapEnumHistoryToResponse
} from './history-registry';

// Heat Pump - Power (Yield + Power with modes)
registerHistory('heatpump-power', async (device, selector) => {
  const heatPump = await device.getHeatPumpCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getCurrentYieldHistory(hs), selector),
        label: 'Yield'
      },
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getCurrentPowerHistory(hs), selector),
        label: 'Power'
      }
    ],
    modes: {
      data: await mapEnumHistoryToResponse((hs) => heatPump.getModeHistory(hs), selector, {
        0: 'UNKNOWN',
        1: 'STANDBY',
        2: 'HEATING',
        3: 'DHW',
        4: 'DEICING',
        5: 'FROST_PROTECTION',
      }),
      details: [
        { value: 'HEATING', label: 'Heating' },
        { value: 'DEICING', label: 'Deicing' },
        { value: 'FROST_PROTECTION', label: 'Frost Protection' },
        { value: 'DHW', label: 'Hot Water' }
      ]
    }
  };
});

// Heat Pump - Outside Temperature
registerHistory('heatpump-outside-temp', async (device, selector) => {
  const heatPump = await device.getHeatPumpCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getOutsideTemperatureHistory(hs), selector),
        label: 'Outside Temperature'
      }
    ]
  };
});

// Heat Pump - DHW Temperature
registerHistory('heatpump-dhw-temp', async (device, selector) => {
  const heatPump = await device.getHeatPumpCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getDHWTemperatureHistory(hs), selector),
        label: 'Hot Water Temperature'
      }
    ]
  };
});

// Heat Pump - Flow Temperature (Flow + Return)
registerHistory('heatpump-flow-temp', async (device, selector) => {
  const heatPump = await device.getHeatPumpCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getActualFlowTemperatureHistory(hs), selector),
        label: 'Actual Flow Temperature'
      },
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getReturnTemperatureHistory(hs), selector),
        label: 'Return Temperature'
      }
    ]
  };
});

// Heat Pump - System Pressure
registerHistory('heatpump-pressure', async (device, selector) => {
  const heatPump = await device.getHeatPumpCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => heatPump.getSystemPressureHistory(hs), selector),
        label: 'System Pressure'
      }
    ]
  };
});

// Thermostat
registerHistory('thermostat', async (device, selector) => {
  const thermostat = await device.getThermostatCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => thermostat.getCurrentTemperatureHistory(hs), selector),
        label: 'Current Temperature',
        yAxisID: 'yTemperature'
      },
      {
        data: await mapNumericHistoryToResponse((hs) => thermostat.getTargetTemperatureHistory(hs), selector),
        label: 'Target Temperature',
        yAxisID: 'yTemperature'
      }
    ],
    bar: {
      data: await mapNumericHistoryToResponse((hs) => thermostat.getPowerHistory(hs), selector),
      label: 'Power',
      yAxisID: 'yPercentage'
    }
  };
});

// Light
registerHistory('light', async (device, selector) => {
  const light = await device.getLightCapability();

  return {
    lines: [
      {
        data: await mapNumericHistoryToResponse((hs) => light.getBrightnessHistory(hs), selector),
        label: 'Brightness'
      }
    ],
    modes: {
      data: await mapBooleanHistoryToResponse((hs) => light.getIsOnHistory(hs), selector),
      details: [
        { value: true, label: 'On', fillColor: 'rgba(255, 165, 0, 0.3)' }
      ]
    }
  };
});
