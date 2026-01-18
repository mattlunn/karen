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
import { BooleanEventApiResponse, EnumEventApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../../api/types';
import { clampAndSortHistory } from '../../helpers/history';
import { Box } from '@mantine/core';

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
    position: 'left' | 'right',
    max: number,
    min: number,
  }>

  yMin?: number
  yMax?: number
};

function assertAndGetMinMax(lines: { data: HistoryDetailsApiResponse<NumericEventApiResponse>; }[]): { min: string; max: string; } {
  if (lines.length === 0) {
    throw new Error('Graph has no data');
  }

  const min = lines[0].data.since;
  const max = lines[0].data.until;

  for (let i=1;i<lines.length;i++) {
    if (lines[i].data.since !== min || lines[i].data.until !== max) {
      throw new Error(`Dataset 0 and ${i} have differing since/ untils`);
    }
  }

  return {
    min,
    max
  };
}

export function CapabilityGraph(props: CapabilityGraphProps) {
  const { min, max } = assertAndGetMinMax(props.lines);
  const datasets: ChartDataset<"line", { x: string; y: number; }[]>[] = props.lines.map(x => ({
    type: 'line',
    data: mapNumericDataToDataset(x.data),
    label: x.label,
    yAxisID: x.yAxisID || 'y'
  }));

  // TODO: Fixme any
  const chartOptions: any = {
    scales: {
      x: {
        type: 'time',
        time: {
          unit: 'minute'
        },
        ticks: {
          source: 'auto',
          stepSize: 15
        },
        min,
        max
      }
    },

    plugins: {
      annotation: {
        annotations: {}
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
      chartOptions.scales[axisId] = {
        type: 'linear',
        ...axisDetails
      };
    }
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
    <Box style={{ height: '600px' }} mb="lg">
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