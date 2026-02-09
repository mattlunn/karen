import React from 'react';
import { Title } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import DeviceControl from './device-control';
import { library } from '@fortawesome/fontawesome-svg-core';
import type { IconName } from '@fortawesome/fontawesome-svg-core';
import { faCouch, faHouseFire, faUtensils, faJugDetergent, faStairs, faDumbbell, faComputer, faBed, faToiletPaper, faDoorClosed, faDoorOpen, faShop, faTree } from '@fortawesome/free-solid-svg-icons';
import type { RestDeviceResponse } from '../api/types';
import styles from './groups.module.css';
import { getDeviceIcon, getDeviceMetrics } from './capabilities/registry';

library.add(faCouch, faUtensils, faJugDetergent, faStairs, faDumbbell, faBed, faToiletPaper, faComputer, faHouseFire, faDoorClosed, faDoorOpen, faShop, faTree);

function DeviceHomeControl({ device }: { device: RestDeviceResponse }) {
  const metrics = getDeviceMetrics(device);
  const primary = metrics[0];

  return (
    <DeviceControl
      device={device}
      icon={primary?.icon ?? getDeviceIcon(device)}
      color={primary?.iconColor ?? '#04A7F4'}
      colorIconBackground={primary?.iconHighlighted ?? false}
      values={metrics.slice(0, 3).map((m) => m.value)}
      iconOnClick={primary?.onIconClick}
    />
  );
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
              <DeviceHomeControl device={device} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
