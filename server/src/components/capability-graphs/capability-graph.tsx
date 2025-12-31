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
import 'chartjs-adapter-moment';
import { EnumEventApiResponse, HistoryDetailsApiResponse, NumericEventApiResponse } from '../../api/types';
import moment from 'moment';
import 'chartjs-adapter-moment';
import { clampAndSortHistory } from '../../helpers/history';

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

function mapNumericDataToDataset(numericEventHistory: HistoryDetailsApiResponse<NumericEventApiResponse>) {
  const sortedEvents = clampAndSortHistory(numericEventHistory.history, numericEventHistory.since, numericEventHistory.until, false);

  return sortedEvents.reduce((acc: ({ x: string, y: number })[], curr) => {
    acc.push({
      x: curr.start,
      y: curr.value
    }, {
      x: curr.end!,
      y: curr.value
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

  yAxis?: Record<string, {
    position: 'left' | 'right',
    max: number,
    min: number
  }>

  yMin?: number
  yMax?: number
};

function assetAndGetMinMax(lines: { data: HistoryDetailsApiResponse<NumericEventApiResponse>; }[]): { min: string; max: string; } {
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
  const { min, max } = assetAndGetMinMax(props.lines);
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
        }
      }
    },

    plugins: {
      annotation: {
        annotations: {}
      }
    }
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
      max: props.yMax
    };
  }

  if (props.zones) {
    chartOptions.plugins.annotation = {
      annotations: {}
    };

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
    <Chart 
      type="line"
      data={{
        datasets
      }} 
      
      options={chartOptions}
    />
  );
}