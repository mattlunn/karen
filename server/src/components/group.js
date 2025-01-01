import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faThermometerFull, faLightbulb, faBed, faToiletPaper, faPlug, faPersonWalking } from '@fortawesome/free-solid-svg-icons';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faPlug, faComputer);

function createIfCapabilitySatisfied(device, condition, creator) {
  const matchedCapability = device.capability.find(condition);

  if (matchedCapability) {
    return creator(device, matchedCapability);
  }

  return null;
}

function buildDeviceControlForDevice(device) {
  createIfCapabilitySatisfied(device, x => x.__typename === 'Thermostat', (device, capability) => (
    <DeviceControl device={device} icon={faThermometerFull} color="#ff6f22" colorIconBackground={capability.isHeating} values={[
      `${capability.currentTemperature.toFixed(1)}°`,
      `${capability.targetTemperature.toFixed(1)}°`,
      `${capability.power}%`
    ]} />
  ));

  switch (device.__typename) {
    case 'Thermostat':
      
    case 'Light':
      return (
        <DeviceControl device={device} icon={faLightbulb} color="#ffa24d" colorIconBackground={device.isOn} values={[
          device.isOn ? 'On' : 'Off',
          `${device.brightness}%`
        ]} />
      );
    case 'BasicDevice': {
      const motionSensor = device.sensors.find(x => x.__typename === 'MotionSensor');

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
          device.sensors.map((sensor) => {
            switch (sensor.__typename) {
              case 'TemperatureSensor':
                return `${sensor.currentTemperature.toFixed(1)}°`;
              case 'LightSensor':
                return `${sensor.illuminance}lx`;
            }
          }).filter(x => x)
        } />
      ); 
    }
  }
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