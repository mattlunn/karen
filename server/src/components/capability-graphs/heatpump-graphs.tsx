import React from 'react';
import { DeviceApiResponse } from '../../api/types';
import { CapabilityGraph } from './capability-graph';

export function HeatPumpCapabilityGraph({ response } : { response: DeviceApiResponse }) {
  const heatPumpCapability = response.device.capabilities.find(x => x.type === 'HEAT_PUMP');

  if (!heatPumpCapability) {
    return <></>
  }

  return (
    <>
      <CapabilityGraph 
        lines={[{
          data: heatPumpCapability.yieldHistory,
          label: 'Yield'
        }, {
          data: heatPumpCapability.powerHistory,
          label: 'Power'
        }]}
       
        modes={{
          data: heatPumpCapability.modeHistory,
          details: [{
            value: 'HEATING',
            label: 'Heating',
          }, {
            value: 'DEICING',
            label: 'Deicing',
          }, {
            value: 'FROST_PROTECTION',
            label: 'Frost Protection',
          }, {
            value: 'DHW',
            label: 'Hot Water',
          }]
        }}
      />

      <CapabilityGraph 
        lines={[{
          data: heatPumpCapability.outsideTemperatureHistory,
          label: 'Outside Temperature'
        }]}

        yMin={-10}
      />

      <CapabilityGraph 
        lines={[{
          data: heatPumpCapability.dHWTemperatureHistory,
          label: 'Hot Water Temperature'
        }]}
      />

      <CapabilityGraph 
        lines={[{
          data: heatPumpCapability.actualFlowTemperatureHistory,
          label: 'Actual Flow Temperature'
        }, {
          data: heatPumpCapability.returnTemperatureHistory,
          label: 'Return Temperature'
        }]}
      />

      <CapabilityGraph
        lines={[{
          data: heatPumpCapability.systemPressureHistory,
          label: 'System Pressure'
        }]}

        zones={[{
          min: 0,
          max: 1,
          color: 'rgba(255, 0, 55, 0.25)',
        }, {
          min: 1,
          max: 2,
          color: 'rgba(31, 135, 0, 0.25)',
        }]}

        yMin={0}
        yMax={2}
      />
    </>
  );
}