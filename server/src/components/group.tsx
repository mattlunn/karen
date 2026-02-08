import React, { ReactNode } from 'react';
import { Title } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faHouseFire, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faBed, faToiletPaper, faPlug, faPersonWalking, faVideo, faDroplet, faToggleOff, faFire, faDoorClosed, faDoorOpen, faShop, faTree } from '@fortawesome/free-solid-svg-icons';
import Light from './devices/light';
import Lock from './devices/lock';
import Thermostat from './devices/thermostat';
import type { RestDeviceResponse, CapabilityApiResponse } from '../api/types';
import styles from './groups.module.css';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faPlug, faComputer, faHouseFire, faDoorClosed, faDoorOpen, faShop, faTree);

interface CapabilityCreator {
  predicate: (cap: CapabilityApiResponse) => boolean;
  creator: (device: RestDeviceResponse, capability: CapabilityApiResponse) => ReactNode;
}

function createIfCapabilitySatisfied(device: RestDeviceResponse, creators: CapabilityCreator[], fallback: (device: RestDeviceResponse) => ReactNode): ReactNode {
  for (const { predicate, creator } of creators) {
    const matchedCapability = device.capabilities.find(predicate);

    if (matchedCapability) {
      return creator(device, matchedCapability);
    }
  }

  return fallback(device);
}

function buildDeviceControlForDevice(device: RestDeviceResponse) {
  return createIfCapabilitySatisfied(device, [
    {
      predicate: (x) => x.type === 'THERMOSTAT',
      creator: (device, capability) => <Thermostat device={device} capability={capability as Extract<CapabilityApiResponse, { type: 'THERMOSTAT' }>} />,
    },
    {
      predicate: (x) => x.type === 'LIGHT',
      creator: (device, capability) => <Light device={device} capability={capability as Extract<CapabilityApiResponse, { type: 'LIGHT' }>} />,
    },
    {
      predicate: (x) => x.type === 'CAMERA',
      creator: (device) => (
        <DeviceControl device={device} icon={faVideo} color="#04A7F4" colorIconBackground={false} values={[]} />
      ),
    },
    {
      predicate: (x) => x.type === 'HUMIDITY_SENSOR',
      creator: (device, capability) => {
        const humidityCap = capability as Extract<CapabilityApiResponse, { type: 'HUMIDITY_SENSOR' }>;
        const tempCap = device.capabilities.find((x) => x.type === 'TEMPERATURE_SENSOR');
        return (
          <DeviceControl device={device} icon={faDroplet} color="#04A7F4" colorIconBackground={false} values={[
            `${humidityCap.humidity.value}%`,
            `${tempCap && 'currentTemperature' in tempCap ? tempCap.currentTemperature.value.toFixed(1) : '?'}°`
          ]} />
        );
      },
    },
    {
      predicate: (x) => x.type === 'SWITCH',
      creator: (device, capability) => {
        const switchCap = capability as Extract<CapabilityApiResponse, { type: 'SWITCH' }>;
        return (
          <DeviceControl device={device} icon={faToggleOff} color="#04A7F4" colorIconBackground={switchCap.isOn.value} values={[]} />
        );
      },
    },
    {
      predicate: (x) => x.type === 'LOCK',
      creator: (device, capability) => <Lock device={device} capability={capability as Extract<CapabilityApiResponse, { type: 'LOCK' }>} />,
    },
    {
      predicate: (x) => x.type === 'HEAT_PUMP',
      creator: (device, capability) => {
        const heatPumpCap = capability as Extract<CapabilityApiResponse, { type: 'HEAT_PUMP' }>;
        return (
          <DeviceControl device={device} icon={faFire} color="#04A7F4" colorIconBackground={heatPumpCap.mode.value !== 'STANDBY'} values={[
            `${heatPumpCap.mode.value[0]}${heatPumpCap.mode.value.slice(1).toLowerCase()}`,
            `${heatPumpCap.dayPower.value}kW`,
            `${heatPumpCap.heatingCoP.value} CoP`,
            `${heatPumpCap.compressorModulation.value}%`
          ]} />
        );
      },
    },
  ], (device) => {
    const motionSensor = device.capabilities.find((x) => x.type === 'MOTION_SENSOR');

    let icon;
    let colorIconBackground;

    if (!motionSensor || motionSensor.type !== 'MOTION_SENSOR') {
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
        }).filter((x): x is string => x !== undefined)
      } />
    );
  });
}

interface GroupProps {
  displayIconName: IconName | null;
  name: string;
  devices: RestDeviceResponse[];
}

export default function Group({ displayIconName, name, devices }: GroupProps) {
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
