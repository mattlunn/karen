import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';
import { Anchor } from '@mantine/core';
import ThermostatHeatMap from './thermostat-heat-map';
import classNames from 'classnames';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import IssuesIndicator from './issues-indicator';

export default function DeviceControl({ icon, iconOnClick = (e) => e.preventDefault(), actionPending = false, colorIconBackground, color, device, values = [], showMap }) {
  return (
    <>
      <div className="device-control__header">
        <a className={classNames('device-control__icon-container', actionPending && 'device-control__icon-container--disabled')} style={{ backgroundColor: colorIconBackground ? color + '50' : 'transparent' }} onClick={iconOnClick} href="#">
          <FontAwesomeIcon icon={actionPending ? faSync : icon} spin={actionPending} color={color} />
        </a>
        <div className="device-control__body">
          <h4 className="device-control__name"><Anchor component={Link} to={`/device/${device.id}`}>{device.name}</Anchor></h4>
          <ul className="device-control__values">
            {values.map((value, idx) => <li className="device-control__value" key={idx}>{value}</li>)}
            <li className="device-control__value device-control__value--warning">
              <IssuesIndicator device={device} />
            </li>
          </ul>
        </div>
      </div>
      {false && (
        <div className="device-control__footer">
          {showMap && <ThermostatHeatMap activity={[]} withHours={false} colorMask={color} />}
        </div>
      )}
    </>
  );
}
