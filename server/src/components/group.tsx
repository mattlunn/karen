import React, { ReactNode } from 'react';
import { Title } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faHouseFire, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faBed, faToiletPaper, faDoorClosed, faDoorOpen, faShop, faTree } from '@fortawesome/free-solid-svg-icons';
import Light from './devices/light';
import Lock from './devices/lock';
import Thermostat from './devices/thermostat';
import type { RestDeviceResponse, CapabilityApiResponse } from '../api/types';
import styles from './groups.module.css';
import { getDeviceIcon, getDeviceMetrics } from './capabilities/registry';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faComputer, faHouseFire, faDoorClosed, faDoorOpen, faShop, faTree);

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
  /* eslint-disable react/display-name */
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
      predicate: (x) => x.type === 'LOCK',
      creator: (device, capability) => <Lock device={device} capability={capability as Extract<CapabilityApiResponse, { type: 'LOCK' }>} />,
    },
    {
      predicate: (x) => x.type === 'HUMIDITY_SENSOR',
      creator: (device, capability) => {
        const humidityCap = capability as Extract<CapabilityApiResponse, { type: 'HUMIDITY_SENSOR' }>;
        const tempCap = device.capabilities.find((x) => x.type === 'TEMPERATURE_SENSOR');
        const metrics = getDeviceMetrics(device);
        return (
          <DeviceControl device={device} icon={getDeviceIcon(device)} color={metrics[0]?.iconColor ?? '#04A7F4'} colorIconBackground={metrics[0]?.iconHighlighted ?? false} values={[
            `${humidityCap.humidity.value}%`,
            `${tempCap && 'currentTemperature' in tempCap ? tempCap.currentTemperature.value.toFixed(1) : '?'}°`
          ]} />
        );
      },
    },
    {
      predicate: (x) => x.type === 'HEAT_PUMP',
      creator: (device, capability) => {
        const heatPumpCap = capability as Extract<CapabilityApiResponse, { type: 'HEAT_PUMP' }>;
        const metrics = getDeviceMetrics(device);
        return (
          <DeviceControl device={device} icon={getDeviceIcon(device)} color={metrics[0]?.iconColor ?? '#04A7F4'} colorIconBackground={metrics[0]?.iconHighlighted ?? false} values={[
            `${heatPumpCap.mode.value[0]}${heatPumpCap.mode.value.slice(1).toLowerCase()}`,
            `${heatPumpCap.dayPower.value}kW`,
            `${heatPumpCap.heatingCoP.value} CoP`,
            `${heatPumpCap.compressorModulation.value}%`
          ]} />
        );
      },
    },
  /* eslint-enable react/display-name */
  ], (device) => {
    const metrics = getDeviceMetrics(device);
    const icon = getDeviceIcon(device);
    const colorIconBackground = metrics[0]?.iconHighlighted ?? false;

    return (
      <DeviceControl device={device} icon={icon} color={metrics[0]?.iconColor ?? '#04A7F4'} colorIconBackground={colorIconBackground} values={
        metrics.slice(0, 2).map((m) => String(m.value))
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
