import React from 'react';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import DeviceControl from '../device-control';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';

function BrightnessControl({ device, capability }) {
  const brightness = capability.brightness;
  const options = [];
  const [setBrightness, { loading }] = useMutation(gql`
    mutation updateLight($id: ID!, $brightness: Int) {
      updateLight(id: $id, brightness: $brightness) {
        id
        name

        capabilities {
          ... on Light {
            brightness
            isOn
          }
        }
      }
    }
  `);

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
        variables: {
          id: device.id,
          brightness: Number(e.target.value)
        }
      });
      
      e.preventDefault();
    }} defaultValue={selectedValue}>
      {options}
    </select>
  );
}

export default function Light({ device, capability }) {
  const [setLightSwitchStatus, { loading }] = useMutation(gql`
    mutation updateLight($id: ID!, $isOn: Boolean) {
      updateLight(id: $id, isOn: $isOn) {
        id
        name

        capabilities {
          ... on Light {
            isOn
          }
        }
      }
    }
  `);

  return (
    <DeviceControl device={device} icon={faLightbulb} color="#ffa24d" colorIconBackground={capability.isOn} values={[
      capability.isOn ? 'On' : 'Off',
      <BrightnessControl device={device} capability={capability} />
    ]} actionPending={loading} iconOnClick={(e) => {
      e.preventDefault();

      if (loading) return;

      setLightSwitchStatus({
        variables: {
          id: device.id,
          isOn: !capability.isOn
        }
      });
    }} />
  );
}