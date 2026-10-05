import React from 'react';
import { Chart as ChartJS, LinearScale, PointElement, LineElement, LineController, Tooltip } from 'chart.js';
import AnnotationPlugin from 'chartjs-plugin-annotation';
import { Chart } from 'react-chartjs-2';
import { Box, Text } from '@mantine/core';
import type { CapabilityApiResponse } from '../api/types';

ChartJS.register(LinearScale, PointElement, LineElement, LineController, Tooltip, AnnotationPlugin);

type ElectricVehicleCapability = Extract<CapabilityApiResponse, { type: 'ELECTRIC_VEHICLE' }>;

export default function ChargePriceCapGraph({ capability }: { capability: ElectricVehicleCapability }) {
  const curve = capability.chargePriceCapCurve;
  const chargePercentage = capability.chargePercentage.value;

  if (curve.length === 0) {
    return (
      <Box style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Text c="dimmed">No price history available</Text>
      </Box>
    );
  }

  return (
    <Box style={{ height: '400px' }}>
      <Chart
        type="line"
        data={{
          datasets: [{
            label: 'Price cap',
            data: curve.map(({ chargePercentage, pence }) => ({ x: chargePercentage, y: pence })),
            pointRadius: 0,
          }],
        }}
        options={{
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          scales: {
            x: {
              type: 'linear',
              min: 0,
              max: 100,
              ticks: { stepSize: 10, callback: (value) => `${value}%` },
              title: { display: true, text: 'Battery' },
            },
            y: {
              type: 'linear',
              ticks: { callback: (value) => `${value}p` },
              title: { display: true, text: 'p/kWh' },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                title: ([item]) => `${item.parsed.x}%`,
                label: (item) => `${item.parsed.y!.toFixed(1)}p/kWh`,
              },
            },
            annotation: {
              annotations: chargePercentage === null ? {} : {
                current: {
                  type: 'line',
                  scaleID: 'x',
                  value: chargePercentage,
                  borderColor: '#2ecc71',
                  borderDash: [6, 4],
                  label: { display: true, content: `Now: ${chargePercentage}%`, position: 'start' },
                },
              },
            },
          },
        }}
      />
    </Box>
  );
}
