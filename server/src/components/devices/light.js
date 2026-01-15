import React from 'react';
import DeviceControl from '../device-control';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';
import useApiMutation from '../../hooks/api-mutation';

function BrightnessControl({ device, capability }) {
  const brightness = capability.brightness;
  const options = [];
  const { mutate: setBrightness, loading } = useApiMutation(`/device/${device.id}/light`);

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

export default function Light({ device, capability }) {
  const { mutate: setLightSwitchStatus, loading } = useApiMutation(`/device/${device.id}/light`);

  return (
    <DeviceControl device={device} icon={faLightbulb} color="#ffa24d" colorIconBackground={capability.isOn} values={[
      capability.isOn ? 'On' : 'Off',
      <BrightnessControl device={device} capability={capability} key={1}/>
    ]} actionPending={loading} iconOnClick={(e) => {
      e.preventDefault();

      if (loading) return;

      setLightSwitchStatus({
        isOn: !capability.isOn
      });
    }} />
  );
}