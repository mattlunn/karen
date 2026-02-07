import React from 'react';
import { Title } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faHouseFire, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faThermometerFull, faLightbulb, faBed, faToiletPaper, faPlug, faPersonWalking, faVideo, faDroplet, faToggleOff, faFire, faDoorClosed, faDoorOpen, faShop, faTree } from '@fortawesome/free-solid-svg-icons';
import Light from './devices/light';
import Lock from './devices/lock';
import Thermostat from './devices/thermostat';
import styles from './groups.module.css';

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
    (device, capability) => <Thermostat device={device} capability={capability} />,

    x => x.type === 'LIGHT',
    (device, capability) => <Light device={device} capability={capability} />,

    x => x.type === 'CAMERA',
    (device, capability) => (
      <DeviceControl device={device} icon={faVideo} color="#04A7F4" colorIconBackground={false} values={[]} />
    ),

    x => x.type === 'HUMIDITY_SENSOR',
    (device, capability) => (
      <DeviceControl device={device} icon={faDroplet} color="#04A7F4" colorIconBackground={false} values={[
        `${capability.humidity.value}%`,
        `${device.capabilities.find(x => x.type === 'TEMPERATURE_SENSOR')?.currentTemperature?.value?.toFixed(1) ?? '?'}°`
      ]} />
    ),

    x => x.type === 'SWITCH',
    (device, capability) => (
      <DeviceControl device={device} icon={faToggleOff} color="#04A7F4" colorIconBackground={capability.isOn.value} values={[]} />
    ),

    x => x.type === 'LOCK',
    (device, capability) => <Lock device={device} capability={capability} />,

    x => x.type === 'HEAT_PUMP',
    (device, capability) => (
      <DeviceControl device={device} icon={faFire} color="#04A7F4" colorIconBackground={capability.mode.value !== 'STANDBY'} values={[
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
        <DeviceControl device={device} icon={icon} color="#04A7F4" colorIconBackground={colorIconBackground} values={
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
      <Title order={3} className={styles.title}>
        {displayIconName && <FontAwesomeIcon icon={displayIconName} className={styles.titleIcon} />}
        {name}
      </Title>
      <div>
        <ul className={styles.deviceControls}>
          {devices.map(device => (
            <li className={styles.deviceControl} key={device.id}>
              {buildDeviceControlForDevice(device)}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
