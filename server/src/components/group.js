import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';

import { library } from '@fortawesome/fontawesome-svg-core'
import { faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faThermometerFull, faLightbulb, faBed, faToiletPaper, faPlug } from '@fortawesome/free-solid-svg-icons'

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faPlug );

const deviceControlsSettings = new Map();

function DeviceControlSettings(icon, color, values) {
  this.icon = icon;
  this.color = color;
  this.values = values;
}

deviceControlsSettings.set('Thermostat', new DeviceControlSettings(faThermometerFull, '#ff6f22', (thermostat) => [
  `${thermostat.currentTemperature.toFixed(1)}°`,
  `${thermostat.power}%`
]));

deviceControlsSettings.set('Light', new DeviceControlSettings(faLightbulb, '#ffa24d', (light) => [
  light.isOn ? 'On' : 'Off',
  `${light.brightness}%`
]));

deviceControlsSettings.set('BasicDevice', new DeviceControlSettings(faPlug, '#00a8f4'));

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
            <li className="group__device-control">
              <DeviceControl device={device} {...deviceControlsSettings.get(device.__typename)} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}