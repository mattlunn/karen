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
  Filler,
  ChartDataset,
  Point
} from 'chart.js';
import AnnotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-dayjs-4';
import dayjs from '../../dayjs';
import { BooleanEventApiResponse, EnumEventApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../../api/types';
import { clampAndSortHistory } from '../../helpers/history';
import { Box, Text } from '@mantine/core';

export function inferTimeUnit(min: string, max: string): 'minute' | 'hour' | 'day' {
  const diffDays = dayjs(max).diff(dayjs(min), 'day');

  if (diffDays >= 3) {
    return 'day';
  } else if (diffDays >= 1) {
    return 'hour';
  }
  return 'minute';
}

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

function mapNumericDataToDataset(numericEventHistory: HistoryDetailsApiResponse<NumericEventApiResponse | BooleanEventApiResponse | EnumEventApiResponse>) {
  const sortedEvents = clampAndSortHistory(numericEventHistory.history, numericEventHistory.since, numericEventHistory.until, false);

  return sortedEvents.reduce((acc: ({ x: string, y: number })[], curr) => {
    acc.push({
      x: curr.start,
      y: typeof curr.value === 'number' ? curr.value : 1
    }, {
      x: curr.end!,
      y: typeof curr.value === 'number' ? curr.value : 1
    });

    return acc;
  }, []);
}

export type CapabilityGraphProps = {
  lines: {
    data: HistoryDetailsApiResponse<NumericEventApiResponse>,
    label: string,
    yAxisID?: string
  }[]

  bar?: {
    data: HistoryDetailsApiResponse<NumericEventApiResponse>,
    label: string,
    yAxisID?: string
  }

  zones?: {
    min: number;
    max: number;
    color: string;
  }[]

  modes?: {
    data: HistoryDetailsApiResponse<EnumEventApiResponse | BooleanEventApiResponse>,
    details: {
      value: string | true;
      label: string;
      fillColor?: string
    }[]
  }

  yAxis?: Record<string, {
    position?: 'left' | 'right',
    max?: number,
    min?: number,
  }>

  yMin?: number
  yMax?: number
  timeUnit?: 'minute' | 'hour' | 'day'
  height?: string
};

function getMinMax(props: CapabilityGraphProps): { min: string; max: string } | null {
  if (props.lines.length > 0) {
    const min = props.lines[0].data.since;
    const max = props.lines[0].data.until;

    for (let i = 1; i < props.lines.length; i++) {
      if (props.lines[i].data.since !== min || props.lines[i].data.until !== max) {
        throw new Error(`Dataset 0 and ${i} have differing since/ untils`);
      }
    }

    return { min, max };
  }

  if (props.bar) {
    return { min: props.bar.data.since, max: props.bar.data.until };
  }

  if (props.modes) {
    return { min: props.modes.data.since, max: props.modes.data.until };
  }

  return null;
}

export function CapabilityGraph(props: CapabilityGraphProps) {
  const height = props.height || '600px';
  const minMax = getMinMax(props);

  if (!minMax) {
    return (
      <Box style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} mb="lg">
        <Text c="dimmed">No data available</Text>
      </Box>
    );
  }

  const { min, max } = minMax;
  const modesOnly = props.lines.length === 0;

  const datasets: ChartDataset<"line", { x: string; y: number; }[]>[] = props.lines.map(x => ({
    type: 'line',
    data: mapNumericDataToDataset(x.data),
    label: x.label,
    yAxisID: x.yAxisID || 'y'
  }));

  const timeUnit = props.timeUnit || inferTimeUnit(min, max);
  const tickStepSize = timeUnit === 'day' ? 1 : 15;

  // TODO: Fixme any
  const chartOptions: any = {
    scales: {
      x: {
        type: 'time',
        time: {
          unit: timeUnit
        },
        ticks: {
          source: 'auto',
          stepSize: tickStepSize
        },
        min,
        max
      }
    },

    plugins: {
      annotation: {
        annotations: {}
      },

      colors: {
        forceOverride: true
      }
    },

    maintainAspectRatio: false
  };

  if (props.bar) {
    datasets.push({
      type: 'line',
      fill: 'start',
      data: mapNumericDataToDataset(props.bar.data),
      label: props.bar.label,
      yAxisID: props.bar.yAxisID || 'y',
      pointHitRadius: 10,
      pointRadius: 0,
      borderWidth: 1,
      stepped: true
    });
  }

  if (props.modes) {
    const sortedEvents = clampAndSortHistory(props.modes.data.history, props.modes.data.since, props.modes.data.until, true);

    for (let i=0;i<props.modes.details.length;i++) {
      const mode = props.modes.details[i];
      const axisName = `yMode${i}`;

      datasets.push({
        type: 'line',
        fill: 'start',
        data: sortedEvents.reduce((acc: ({ x: string, y: number })[], curr) => {
          if (curr.value === mode.value) {
            acc.push({
              x: curr.start,
              y: 0
            }, {
              x: curr.start,
              y: 1
            }, {
              x: curr.end!,
              y: 1
            }, {
              x: curr.end!,
              y: 0
            });
          }

          return acc;
        }, []),
        label: mode.label,
        yAxisID: axisName,
        pointRadius: 0,
        borderWidth: 1,
        stepped: true,
        backgroundColor: mode.fillColor
      });

      chartOptions.scales[axisName] = {
        type: 'linear',
        min: 0,
        max: 1,
        display: false
      };
    }
  }

  if (props.yAxis) {
    for (const [axisId, axisDetails] of Object.entries(props.yAxis)) {
      const scaleConfig: any = {
        type: 'linear',
        ...axisDetails
      };

      if (modesOnly) {
        scaleConfig.ticks = { color: 'transparent' };
        scaleConfig.grid = { display: false };
      }

      chartOptions.scales[axisId] = scaleConfig;
    }
  }

  // In modes-only mode, add a dummy dataset so Chart.js creates the yAxis
  // scales (it only creates scales referenced by a dataset)
  if (modesOnly && props.yAxis) {
    const axisId = Object.keys(props.yAxis)[0];

    datasets.unshift({
      type: 'line',
      data: [],
      yAxisID: axisId,
      label: '',
      pointRadius: 0,
      borderWidth: 0
    });

    chartOptions.plugins.legend = {
      ...chartOptions.plugins.legend,
      labels: { filter: (item: any) => item.text !== '' }
    };
  }

  if (props.yMin || props.yMax) {
    chartOptions.scales.y = {
      type: 'linear',
      min: props.yMin,
      max: props.yMax,
    };
  }

  if (props.zones) {
    props.zones.forEach((zone, idx) => {
      chartOptions.plugins.annotation.annotations[idx] = {
        type: 'box',
        xMin: min,
        xMax: max,
        yMin: zone.min,
        yMax: zone.max,
        backgroundColor: zone.color,
        borderWidth: 0
      };
    });
  }

  return (
    <Box style={{ height, position: 'relative' }} mb="lg">
      <Chart
        type="line"
        data={{
          datasets
        }}

        options={chartOptions}
      />
    </Box>
  );
}
