import React from 'react';
import { DeviceApiResponse } from '../../api/types';
import { CapabilityGraph } from './capability-graph';

export function ThermostatCapabilityGraph({ response } : { response: DeviceApiResponse }) {
  const thermostatCapability = response.device.capabilities.find(x => x.type === 'THERMOSTAT');

  if (!thermostatCapability) {
    return <></>
  }

  return (
    <CapabilityGraph 
      lines={[{
        data: thermostatCapability.currentTemperatureHistory,
        label: 'Current Temperature',
        yAxisID: 'yTemperature'
      }, {
        data: thermostatCapability.targetTemperatureHistory,
        label: 'Target Temperature',
        yAxisID: 'yTemperature'
      }]}

      bar={{
        data: thermostatCapability.powerHistory,
        label: 'Power',
        yAxisID: 'yPercentage'
      }}

      yAxis={{
        yTemperature: {
          position: 'left',
          max: 30,
          min: 0
        },

        yPercentage: {
          position: 'right',
          max: 100,
          min: 0
        }
      }}
    />
  );
}