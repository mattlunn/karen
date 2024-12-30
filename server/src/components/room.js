import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';

import { library } from '@fortawesome/fontawesome-svg-core'
import { faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faThermometerFull, faLightbulb, faBed, faToiletPaper } from '@fortawesome/free-solid-svg-icons'

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper );

const deviceControlsSettings = new Map();

function DeviceControlSettings(icon, color, values) {
  this.icon = icon;
  this.color = color;
  this.values = values;
}

deviceControlsSettings.set('Thermostat', new DeviceControlSettings(faThermometerFull, '#ff6f22', (thermostat) => [
  `${thermostat.currentTemperature}°`,
  `${thermostat.power}%`
]));

deviceControlsSettings.set('Light', new DeviceControlSettings(faLightbulb, '#ffa24d', (light) => [
  light.isOn ? 'On' : 'Off',
  `${light.brightness}%`
]));

export default function Room({ room, devices }) {
  return (
    <>
      <h3 className="room__title">
        {room.displayIconName && <FontAwesomeIcon icon={room.displayIconName} className="room__title-icon" />}
        {room.name}
      </h3>
      <div>
        <ul className="room__device-controls">
          {devices.map(device => (
            <li className="room__device-control">
              <DeviceControl device={device} {...deviceControlsSettings.get(device.__typename)} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}