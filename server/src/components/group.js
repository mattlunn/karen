import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faHouseFire, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faThermometerFull, faLightbulb, faBed, faToiletPaper, faPlug, faPersonWalking, faVideo, faDroplet, faToggleOff, faFire, faDoorClosed, faDoorOpen, faShop, faTree } from '@fortawesome/free-solid-svg-icons';
import Light from './devices/light';
import Lock from './devices/lock';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faPlug, faComputer, faHouseFire, faDoorClosed, faDoorOpen, faShop, faTree);

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
    x => x.type === 'THERMOSTAT',
    (device, capability) => (
      <DeviceControl device={device} icon={faThermometerFull} color="#ff6f22" colorIconBackground={capability.isHeating} values={[
        `${capability.currentTemperature.toFixed(1)}°`,
        `${capability.targetTemperature.toFixed(1)}°`,
        `${capability.power}%`
      ]} />
    ),

    x => x.type === 'LIGHT',
    (device, capability) => <Light device={device} capability={capability} />,

    x => x.type === 'CAMERA',
    (device, capability) => (
      <DeviceControl device={device} icon={faVideo} color="#04A7F4" colorIconBackground={false} values={[]} />
    ),

    x => x.type === 'HUMIDITY_SENSOR',
    (device, capability) => (
      <DeviceControl device={device} icon={faDroplet} color="#04A7F4" colorIconBackground={false} values={[
        `${capability.humidity}%`,
        `${device.capabilities.find(x => x.type === 'TEMPERATURE_SENSOR')?.currentTemperature?.toFixed(1) ?? '?'}°`
      ]} />
    ),

    x => x.type === 'SWITCH',
    (device, capability) => (
      <DeviceControl device={device} icon={faToggleOff} color="#04A7F4" colorIconBackground={capability.isOn} values={[]} />
    ),

    x => x.type === 'LOCK',
    (device, capability) => <Lock device={device} capability={capability} />,

    x => x.type === 'HEAT_PUMP',
    (device, capability) => (
      <DeviceControl device={device} icon={faFire} color="#04A7F4" colorIconBackground={capability.mode !== 'STANDBY'} values={[
        `${capability.mode[0]}${capability.mode.slice(1).toLowerCase()}`,
        `${capability.dailyConsumedEnergy}kW`,
        `${capability.heatingCoP} CoP`,
        `${capability.compressorModulation}%`
      ]} />
    ),

    (device) => {
      const motionSensor = device.capabilities.find(x => x.type === 'MOTION_SENSOR');

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
            switch (capability.type) {
              case 'TEMPERATURE_SENSOR':
                return `${capability.currentTemperature.toFixed(1)}°`;
              case 'LIGHT_SENSOR':
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
