import React from 'react';
import { DeviceApiResponse } from '../../api/types';
import { CapabilityGraph } from './capability-graph';

export function LightCapabilityGraph({ response } : { response: DeviceApiResponse }) {
  const lightCapability = response.device.capabilities.find(x => x.type === 'LIGHT');

  if (!lightCapability) {
    return <></>
  }

  return (
    <CapabilityGraph 
      lines={[{
        data: lightCapability.brightnessHistory,
        label: 'Brightness',
      }]}

      modes={{
        data: lightCapability.isOnHistory,
        details: [{
          value: true,
          label: 'State',
          fillColor: '#ffa24d75'
        }]
      }}
    />
  );
}