import React from 'react';
import {
  Chart as ChartJS,
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
  TimeScale,
  Colors,
  Filler
} from 'chart.js';
import AnnotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-moment';
import { DeviceApiResponse, EnumEventApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../api/types';
import moment from 'moment';

ChartJS.register(
  LinearScale,
  CategoryScale,
  BarElement,
  PointElement,
  LineElement,
  Legend,
  Tooltip,
  LineController,
  BarController,
  TimeScale,
  Colors,
  Filler,
  AnnotationPlugin
);

function mapNumericDataToDataset(numericEventHistory: NumericEventApiResponse[], history: HistoryDetailsApiResponse) {
  const dataset = [];

  const sortedEvents = numericEventHistory.toSorted((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  if (sortedEvents.length === 0) {
    return [];
  }

  if (sortedEvents.at(0)!.start < history.since) {
    sortedEvents[0].start = history.since;
  }

  if (sortedEvents.at(-1)!.end === null || sortedEvents.at(-1)!.end! > history.until) {
    sortedEvents.at(-1)!.end = history.until;
  }

  for (let currentPeriod = moment(history.since).valueOf(), lastPeriod = moment(history.until).valueOf(), eventIdx = 0; currentPeriod <= lastPeriod; currentPeriod += 60*5*1000) {
    const currentPeriodFormatted = moment(currentPeriod).toISOString();

    // Numeric data should always have at least 1 value representing the period. 
    // We want to record the state at that point of time; e.g. where start is < that moment, but end > that moment.
    // Note that the same event can end up representing multiple periods (if it's start and end are more than <period> apart)

    const representativeEvent = (() => {
      for (; eventIdx < sortedEvents.length; eventIdx++) {
        const event = sortedEvents[eventIdx];

        if (event.end! >= currentPeriodFormatted) {
          return event;
        }
      }

      throw new Error('What scenario is this?');
      return sortedEvents[sortedEvents.length - 1];
    })();

    dataset.push({
      x: currentPeriodFormatted,
      y: representativeEvent.value
    });
  }

  return dataset;
}

function mapEnumDataToDatasets(enumEventHistory: EnumEventApiResponse[], history: HistoryDetailsApiResponse): Record<string, { x: string, y: number }[]> {
  const dataset = [];

  const sortedEvents = enumEventHistory.toSorted((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  if (sortedEvents.length === 0) {
    return {};
  }

  if (sortedEvents.at(0)!.start < history.since) {
    sortedEvents[0].start = history.since;
  }

  if (sortedEvents.at(-1)!.end === null || sortedEvents.at(-1)!.end! > history.until) {
    sortedEvents.at(-1)!.end = history.until;
  }

  const datasets: Record<string, { x: string, y: number }[]> = {};

  for (const event of sortedEvents) {
    if (!datasets[event.value]) {
      datasets[event.value] = [];
    }

    datasets[event.value].push({
      x: event.start,
      y: 1,
    }, {
      x: event.end!,
      y: 1
    }, {
      x: moment(event.end).add(1, 's').toISOString(),
      y: 0,
    });
  }

  return datasets;
}

export function ThermostatCapabilityGraph({ response } : { response: DeviceApiResponse }) {
  const thermostatCapability = response.device.capabilities.find(x => x.type === 'THERMOSTAT');

  if (!thermostatCapability) {
    return <></>
  }

  const currentTemperatureDataset = mapNumericDataToDataset(thermostatCapability.currentTemperatureHistory, response.history);
  const targetTemperatureDataset = mapNumericDataToDataset(thermostatCapability.targetTemperatureHistory, response.history);
  const powerDataset = mapNumericDataToDataset(thermostatCapability.powerHistory, response.history);

  return (
    <Chart type="line" data={{
      datasets: [{
        type: 'line',
        data: currentTemperatureDataset,
        pointRadius: 1,
        label: 'Current Temperature',
        yAxisID: 'yTemperature'
      }, {
        type: 'line',
        data: targetTemperatureDataset,
        pointRadius: 1,
        label: 'Target Temperature',
        yAxisID: 'yTemperature'
      }, {
        type: 'line',
        fill: 'start',
        data: powerDataset,
        label: 'Power',
        yAxisID: 'yPercentage',
        pointRadius: 0,
        borderWidth: 1,
        stepped: true
      }],
    }} options={{
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute'
            },
            ticks: {
              source: 'auto',
              stepSize: 15
            }
          },

          yTemperature: {
            type: 'linear',
            position: 'left',
            max: 30,
            min: 0
          },

          yPercentage: {
            type: 'linear',
            position: 'right',
            max: 100,
            min: 0
          }
        }
      }}
    />
  );
}

export function HeatPumpCapabilityGraph({ response } : { response: DeviceApiResponse }) {
  const heatPumpCapability = response.device.capabilities.find(x => x.type === 'HEAT_PUMP');

  if (!heatPumpCapability) {
    return <></>
  }

  const dhwTemperatureHistory = mapNumericDataToDataset(heatPumpCapability.dHWTemperatureHistory, response.history);
  const outsideTemperatureHistory = mapNumericDataToDataset(heatPumpCapability.outsideTemperatureHistory, response.history);
  const systemPressureHistory = mapNumericDataToDataset(heatPumpCapability.systemPressureHistory, response.history);
  const yieldHistory = mapNumericDataToDataset(heatPumpCapability.yieldHistory, response.history);
  const powerHistory = mapNumericDataToDataset(heatPumpCapability.powerHistory, response.history);
  const actualFlowTemperatureHistory = mapNumericDataToDataset(heatPumpCapability.actualFlowTemperatureHistory, response.history);
  const returnTemperatureHistory = mapNumericDataToDataset(heatPumpCapability.returnTemperatureHistory, response.history);
  const modeHistory = mapEnumDataToDatasets(heatPumpCapability.modeHistory, response.history);

  function createDatasetForMode(mode: string) {
    return {
      type: 'line' as const, 
      yAxisID: 'yModes',
      data: modeHistory[mode.toUpperCase()] || [],
      label: mode,
      stepped: true,
      fill: 'start',
      pointRadius: 0,
      borderWidth: 1,
    };
  }

  return (
    <>
      <Chart type="line" data={{
        datasets: [{
          type: 'line',
          data: yieldHistory,
          label: 'Yield',
          yAxisID: 'y'
        }, {
          type: 'line',
          data: powerHistory,
          label: 'Power',
          yAxisID: 'y'
        }, createDatasetForMode('Heating'), createDatasetForMode('Standby'), createDatasetForMode('DHW'), createDatasetForMode('Frost_Protection'), createDatasetForMode('Deicing')]
      }} options={{
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute'
              },
              ticks: {
                source: 'auto',
                stepSize: 15
              }
            },

            y: {
              position: 'left',
              type: 'linear'
            },

            yModes: {
              type: 'linear',
              position: 'right',
              max: 1,
              min: 0,
              display: false
            },
          }
        }}
      />

      <Chart type="line" data={{
        datasets: [{
          type: 'line',
          data: outsideTemperatureHistory,
          label: 'Outside Temperature',
        }],
      }} options={{
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute'
              },
              ticks: {
                source: 'auto',
                stepSize: 15
              }
            }
          }
        }}
      />

      <Chart type="line" data={{
        datasets: [{
          type: 'line',
          data: dhwTemperatureHistory,
          label: 'Hot Water Temperature',
        }],
      }} options={{
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute'
              },
              ticks: {
                source: 'auto',
                stepSize: 15
              }
            }
          }
        }}
      />

      <Chart type="line" data={{
        datasets: [{
          type: 'line',
          data: actualFlowTemperatureHistory,
          label: 'Actual Flow Temperature',
        }, {
          type: 'line',
          data: returnTemperatureHistory,
          label: 'Return Temperature',
        }],
      }} options={{
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute'
              },
              ticks: {
                source: 'auto',
                stepSize: 15
              }
            }
          }
        }}
      />

      <Chart type="line" height={75} data={{
        datasets: [{
          type: 'line',
          data: systemPressureHistory,
          label: 'System Pressure',
          stepped: true
        }],
      }} options={{
          scales: {
            x: {
              type: 'time',
              time: {
                unit: 'minute'
              },
              ticks: {
                source: 'auto',
                stepSize: 15
              }
            },

            y: {
              min: 0,
              max: 2
            }
          },

          plugins: {
            annotation: {
              annotations: {
                red: {
                  type: 'box',
                  xMin: response.history.since,
                  xMax: response.history.until,
                  yMin: 0,
                  yMax: 1,
                  backgroundColor: 'rgba(255, 0, 55, 0.25)',
                  borderWidth: 0
                },

                green: {
                  type: 'box',
                  xMin: response.history.since,
                  xMax: response.history.until,
                  yMin: 1,
                  yMax: 2,
                  backgroundColor: 'rgba(31, 135, 0, 0.25)',
                  borderWidth: 0
                }
              }
            }
          }
        }}
      />
    </>
  );
}