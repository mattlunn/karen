import React from 'react';
import DeviceControl from '../device-control';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';
import { useLightMutation } from '../../hooks/mutations/use-device-mutations';

function BrightnessControl({ device, capability }) {
  const brightness = capability.brightness.value;
  const options = [];
  const { mutate: setBrightness, isPending: loading } = useLightMutation(device.id);

  let selectedValue = null;

  for (let i=0;i<=100;i+=5) {
    let shouldSelect = i === brightness || brightness < i && selectedValue === null;

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

export default function Light({ device, capability, isBatteryLow = false }) {
  const { mutate: setLightSwitchStatus, isPending: loading } = useLightMutation(device.id);

  return (
    <DeviceControl device={device} icon={faLightbulb} color="#ffa24d" colorIconBackground={capability.isOn.value} isBatteryLow={isBatteryLow} values={[
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