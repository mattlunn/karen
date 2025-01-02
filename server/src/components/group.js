import React from 'react';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faThermometerFull, faLightbulb, faBed, faToiletPaper, faPlug, faPersonWalking } from '@fortawesome/free-solid-svg-icons';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faPlug, faComputer);

function createIfCapabilitySatisfied(device, ...creators) {
  for (let i=0;i<creators.length-1;i+=2) {
    const matchedCapability = device.capabilities.find(creators[i]);

    if (matchedCapability) {
      return creators[i+1](device, matchedCapability);
    }
  }
  
  return creators.at(-1)(device);
}

function buildDeviceControlForDevice(device) {
  return createIfCapabilitySatisfied(device, 
    x => x.__typename === 'Thermostat', 
    (device, capability) => (
      <DeviceControl device={device} icon={faThermometerFull} color="#ff6f22" colorIconBackground={capability.isHeating} values={[
        `${capability.currentTemperature.toFixed(1)}°`,
        `${capability.targetTemperature.toFixed(1)}°`,
        `${capability.power}%`
      ]} />
    ),
    
    x => x.__typename === 'Light', 
    (device, capability) => {
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
          `${capability.brightness}%`
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
    },

    (device) => {
      const motionSensor = device.capabilities.find(x => x.__typename === 'MotionSensor');

      let icon;
      let colorIconBackground;

      if (motionSensor === undefined) {
        icon = faPlug;
        colorIconBackground = false;
      } else {
        icon = faPersonWalking;
        colorIconBackground = motionSensor.motionDetected;
      }

      return (
        <DeviceControl device={device} icon={icon} color="#04A7F4" colorIconBackground={colorIconBackground} values={
          device.capabilities.map((capability) => {
            switch (capability.__typename) {
              case 'TemperatureSensor':
                return `${capability.currentTemperature.toFixed(1)}°`;
              case 'LightSensor':
                return `${capability.illuminance}lx`;
            }
          }).filter(x => x)
        } />
      );
    },
  );
}

export default function Group({ displayIconName, name, devices }) {
  return (
    <>
      <h3 className="group__title">
        {displayIconName && <FontAwesomeIcon icon={displayIconName} className="group__title-icon" />}
        {name}
      </h3>
      <div>
        <ul className="group__device-controls">
          {devices.map(device => (
            <li className="group__device-control" key={device.id}>
              {buildDeviceControlForDevice(device)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}