import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlug, faPersonWalking } from '@fortawesome/free-solid-svg-icons';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faHouseFire, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faBed, faToiletPaper, faDoorClosed, faDoorOpen, faShop, faTree } from '@fortawesome/free-solid-svg-icons';
import {
  findGroupControl,
  findGroupControlProps,
  getGroupFallbackValues,
} from './capabilities/registry';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faPlug, faComputer, faHouseFire, faDoorClosed, faDoorOpen, faShop, faTree);

function buildDeviceControlForDevice(device) {
  // First, check if any capability has a custom GroupControl component
  const groupControlMatch = findGroupControl(device.capabilities);
  if (groupControlMatch) {
    const { capability, config } = groupControlMatch;
    const GroupControl = config.GroupControl;
    return <GroupControl device={device} capability={capability} />;
  }

  // Next, check if any capability has getGroupControlProps
  const propsMatch = findGroupControlProps(device.capabilities);
  if (propsMatch) {
    const { capability, config } = propsMatch;
    const props = config.getGroupControlProps(capability, device);
    return <DeviceControl device={device} {...props} />;
  }

  // Fallback: render a generic control with sensor values
  const motionSensor = device.capabilities.find(x => x.type === 'MOTION_SENSOR');
  const icon = motionSensor ? faPersonWalking : faPlug;
  const colorIconBackground = motionSensor ? motionSensor.hasMotion.value : false;
  const values = getGroupFallbackValues(device.capabilities);

  return (
    <DeviceControl
      device={device}
      icon={icon}
      color="#04A7F4"
      colorIconBackground={colorIconBackground}
      values={values}
    />
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
