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

function getIsBatteryLow(device) {
  const batteryLowCapability = device.capabilities.find(x => x.type === 'BATTERY_LOW_INDICATOR');
  if (batteryLowCapability) {
    return batteryLowCapability.isLow.value;
  }

  const batteryLevelCapability = device.capabilities.find(x => x.type === 'BATTERY_LEVEL_INDICATOR');
  if (batteryLevelCapability) {
    return batteryLevelCapability.batteryPercentage.value <= 20;
  }

  return false;
}

function buildDeviceControlForDevice(device) {
  const isBatteryLow = getIsBatteryLow(device);

  return createIfCapabilitySatisfied(device,
    x => x.type === 'THERMOSTAT',
    (device, capability) => (
      <DeviceControl device={device} icon={faThermometerFull} color="#ff6f22" colorIconBackground={capability.isHeating.value} isBatteryLow={isBatteryLow} values={[
        `${capability.currentTemperature.value.toFixed(1)}°`,
        `${capability.targetTemperature.value.toFixed(1)}°`,
        `${capability.power.value}%`
      ]} />
    ),

    x => x.type === 'LIGHT',
    (device, capability) => <Light device={device} capability={capability} isBatteryLow={isBatteryLow} />,

    x => x.type === 'CAMERA',
    (device, capability) => (
      <DeviceControl device={device} icon={faVideo} color="#04A7F4" colorIconBackground={false} isBatteryLow={isBatteryLow} values={[]} />
    ),

    x => x.type === 'HUMIDITY_SENSOR',
    (device, capability) => (
      <DeviceControl device={device} icon={faDroplet} color="#04A7F4" colorIconBackground={false} isBatteryLow={isBatteryLow} values={[
        `${capability.humidity.value}%`,
        `${device.capabilities.find(x => x.type === 'TEMPERATURE_SENSOR')?.currentTemperature?.value?.toFixed(1) ?? '?'}°`
      ]} />
    ),

    x => x.type === 'SWITCH',
    (device, capability) => (
      <DeviceControl device={device} icon={faToggleOff} color="#04A7F4" colorIconBackground={capability.isOn.value} isBatteryLow={isBatteryLow} values={[]} />
    ),

    x => x.type === 'LOCK',
    (device, capability) => <Lock device={device} capability={capability} isBatteryLow={isBatteryLow} />,

    x => x.type === 'HEAT_PUMP',
    (device, capability) => (
      <DeviceControl device={device} icon={faFire} color="#04A7F4" colorIconBackground={capability.mode.value !== 'STANDBY'} isBatteryLow={isBatteryLow} values={[
        `${capability.mode.value[0]}${capability.mode.value.slice(1).toLowerCase()}`,
        `${capability.dailyConsumedEnergy.value}kW`,
        `${capability.heatingCoP.value} CoP`,
        `${capability.compressorModulation.value}%`
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
        colorIconBackground = motionSensor.hasMotion.value;
      }

      return (
        <DeviceControl device={device} icon={icon} color="#04A7F4" colorIconBackground={colorIconBackground} isBatteryLow={isBatteryLow} values={
          device.capabilities.map((capability) => {
            switch (capability.type) {
              case 'TEMPERATURE_SENSOR':
                return `${capability.currentTemperature.value.toFixed(1)}°`;
              case 'LIGHT_SENSOR':
                return `${capability.illuminance.value}lx`;
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
