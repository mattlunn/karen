import React, { ReactNode } from 'react';
import DeviceControl from '../device-control';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { useLightMutation } from '../../hooks/mutations/use-device-mutations';
import type { RestDeviceResponse, CapabilityApiResponse } from '../../api/types';

type LightCapability = Extract<CapabilityApiResponse, { type: 'LIGHT' }>;

function BrightnessControl({ device, capability }: { device: RestDeviceResponse; capability: LightCapability }) {
  const brightness = capability.brightness.value;
  const options: ReactNode[] = [];
  const { mutate: setBrightness } = useLightMutation(device.id);

  let selectedValue: number | undefined;

  for (let i=0;i<=100;i+=5) {
    const shouldSelect = i === brightness || brightness < i && selectedValue === undefined;

    if (shouldSelect) {
      selectedValue = i;
    }

    options.push(<option key={i} value={i}>{i}%</option>);
  }

  return (
    <select onChange={(e) => {
      setBrightness({
        brightness: Number(e.target.value)
      });

      e.preventDefault();
    }} defaultValue={selectedValue}>
      {options}
    </select>
  );
}

type LightProps = {
  device: RestDeviceResponse;
  capability: LightCapability;
};

export default function Light({ device, capability }: LightProps) {
  const { mutate: setLightSwitchStatus, isPending: loading } = useLightMutation(device.id);

  return (
    <DeviceControl device={device} icon={faLightbulb} color="#ffa24d" colorIconBackground={capability.isOn.value} values={[
      capability.isOn.value ? 'On' : 'Off',
      <BrightnessControl device={device} capability={capability} key={1}/>
    ]} actionPending={loading} iconOnClick={(e) => {
      e.preventDefault();

      if (loading) return;

      setLightSwitchStatus({
        isOn: !capability.isOn.value
      });
    }} />
  );
}
