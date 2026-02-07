import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import { Anchor, Title } from '@mantine/core';
import ThermostatHeatMap from './thermostat-heat-map';
import classNames from 'classnames';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import IssuesIndicator from './issues-indicator';
import styles from './device-control.module.css';

export default function DeviceControl({ icon, iconOnClick = (e) => e.preventDefault(), actionPending = false, colorIconBackground, color, device, values = [], showMap }) {
  return (
    <>
      <div className={styles.header}>
        <a className={classNames(styles.iconContainer, actionPending && styles.iconContainerDisabled)} style={{ backgroundColor: colorIconBackground ? color + '50' : 'transparent' }} onClick={iconOnClick} href="#">
          <FontAwesomeIcon icon={actionPending ? faSync : icon} spin={actionPending} color={color} />
        </a>
        <div>
          <Title order={4} className={styles.name}><Anchor component={Link} to={`/device/${device.id}`}>{device.name}</Anchor></Title>
          <ul className={styles.values}>
            {values.map((value, idx) => <li className={styles.value} key={idx}>{value}</li>)}
            <li className={styles.value}>
              <IssuesIndicator device={device} />
            </li>
          </ul>
        </div>
      </div>
      {false && (
        <div className={styles.footer}>
          {showMap && <ThermostatHeatMap activity={[]} withHours={false} colorMask={color} />}
        </div>
      )}
    </>
  );
}
