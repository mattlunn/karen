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
  ChartDataset
} from 'chart.js';
import AnnotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';
import 'chartjs-adapter-dayjs-4';
import dayjs from '../../dayjs';
import { BooleanEventApiResponse, EnumEventApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../../api/types';
import { filterClampAndSortHistory } from '../../helpers/history';
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

export type TimeUnit = 'minute' | 'hour' | 'day' | 'month';

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
  const sortedEvents = filterClampAndSortHistory(numericEventHistory.history, numericEventHistory.since, numericEventHistory.until, false);

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

// For periodic aggregates (daily/monthly totals etc.) rather than a continuously-held state:
// one point per bucket (at the bucket's start, matching the axis tick), so a line interpolates
// a trend between buckets instead of plotting a plateau across the whole bucket that jumps at
// the boundary.
//
// setNumericProperty collapses consecutive buckets that share the same value into a single
// event spanning all of them (e.g. four zero-usage days become one row from day 1 to day 5).
// When `period` is given, that span is unrolled back into one point per bucket, so e.g. a bar
// chart still shows four separate zero bars instead of one that silently covers 4 days.
function mapNumericDataToAggregateDataset(numericEventHistory: HistoryDetailsApiResponse<NumericEventApiResponse>, period?: 'day' | 'month') {
  const sortedEvents = filterClampAndSortHistory(numericEventHistory.history, numericEventHistory.since, numericEventHistory.until, false);

  return sortedEvents.reduce((acc: ({ x: string, y: number })[], curr) => {
    // Still the current/in-progress bucket - there's only one point to plot.
    if (!period || !curr.end) {
      acc.push({ x: curr.start, y: curr.value });
      return acc;
    }

    for (let bucket = dayjs(curr.start); bucket.isBefore(curr.end); bucket = bucket.add(1, period)) {
      acc.push({ x: bucket.toISOString(), y: curr.value });
    }

    return acc;
  }, []);
}

export type ModeSeries = {
  data: HistoryDetailsApiResponse<EnumEventApiResponse | BooleanEventApiResponse>,
  details: {
    value: string | true;
    label: string;
    fillColor?: string
  }[]
};

export type CapabilityGraphProps = {
  lines: {
    data: HistoryDetailsApiResponse<NumericEventApiResponse>,
    label: string,
    yAxisID?: string,
    borderDash?: number[],
    period?: 'day' | 'month'
  }[]

  bars?: {
    data: HistoryDetailsApiResponse<NumericEventApiResponse>,
    label: string,
    yAxisID?: string,
    period?: 'day' | 'month'
  }[]

  stacked?: boolean

  zones?: {
    min?: number;
    max?: number;
    color: string;
  }[]

  modes?: ModeSeries[]

  yAxis?: Record<string, {
    position?: 'left' | 'right',
    max?: number,
    min?: number,
    suggestedMax?: number,
  }>

  timeUnit?: TimeUnit
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

  if (props.bars && props.bars.length > 0) {
    return { min: props.bars[0].data.since, max: props.bars[0].data.until };
  }

  const modeSeries = props.modes ?? [];

  if (modeSeries.length > 0) {
    return { min: modeSeries[0].data.since, max: modeSeries[0].data.until };
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
  const modesOnly = props.lines.length === 0 && !props.bars?.length;

  const datasets: (ChartDataset<"line", { x: string; y: number; }[]> | ChartDataset<"bar", { x: string; y: number; }[]>)[] = props.lines.map(x => ({
    type: 'line',
    data: x.period ? mapNumericDataToAggregateDataset(x.data, x.period) : mapNumericDataToDataset(x.data),
    label: x.label,
    yAxisID: x.yAxisID || 'y',
    ...(x.period ? { tension: 0.3 } : {}),
    ...(x.borderDash ? { borderDash: x.borderDash } : {})
  }));

  const timeUnit = props.timeUnit || inferTimeUnit(min, max);
  const tickStepSize = (timeUnit === 'day' || timeUnit === 'month') ? 1 : 15;

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
      },

      legend: {
        onClick: (_e: unknown, legendItem: { datasetIndex: number }, legend: { chart: any }) => {
          const chart = legend.chart;
          const clickedIndex = legendItem.datasetIndex;
          const eligible: number[] = chart.data.datasets
            .map((d: { label?: string }, i: number) => ({ d, i }))
            .filter(({ d }: { d: { label?: string } }) => d.label !== '')
            .map(({ i }: { i: number }) => i);

          const visibleCount = eligible.filter((i: number) => chart.isDatasetVisible(i)).length;
          const clickedVisible = chart.isDatasetVisible(clickedIndex);

          if (visibleCount === eligible.length) {
            // All visible → isolate clicked
            for (const i of eligible) {
              chart.setDatasetVisibility(i, i === clickedIndex);
            }
          } else if (!clickedVisible) {
            // Clicked a hidden one → add it
            chart.setDatasetVisibility(clickedIndex, true);
          } else if (visibleCount === 1) {
            // Clicked the last visible one → restore all
            for (const i of eligible) {
              chart.setDatasetVisibility(i, true);
            }
          } else {
            // Clicked a visible one, others still visible → hide it
            chart.setDatasetVisibility(clickedIndex, false);
          }

          chart.update();
        }
      }
    },

    maintainAspectRatio: false
  };

  if (props.stacked && props.bars) {
    chartOptions.scales.x.stacked = true;
  }

  if (props.bars) {
    for (const bar of props.bars) {
      datasets.push({
        type: 'bar',
        data: mapNumericDataToAggregateDataset(bar.data, bar.period),
        label: bar.label,
        yAxisID: bar.yAxisID || 'y',
        borderWidth: 1,
        ...(props.stacked ? { stack: 'stack' } : {})
      });
    }
  }

  const modeSeries = props.modes ?? [];

  modeSeries.forEach((series, seriesIndex) => {
    const sortedEvents = filterClampAndSortHistory(series.data.history, series.data.since, series.data.until, true);

    for (let i = 0; i < series.details.length; i++) {
      const mode = series.details[i];
      const axisName = `yMode${seriesIndex}_${i}`;

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
  });

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

      if (props.stacked) {
        scaleConfig.stacked = true;
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

  if (props.zones) {
    props.zones.forEach((zone, idx) => {
      chartOptions.plugins.annotation.annotations[idx] = {
        type: 'box',
        xMin: min,
        xMax: max,
        ...(zone.min !== undefined ? { yMin: zone.min } : {}),
        ...(zone.max !== undefined ? { yMax: zone.max } : {}),
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
