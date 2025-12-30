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
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-moment';
import { DeviceApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../api/types';
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
  Filler
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

export default function DeviceGraph({ response } : { response: DeviceApiResponse }) {
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
        tension: 0
      }],
    }} options={{
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'minute'
            },
            ticks: {
              source: 'auto'
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