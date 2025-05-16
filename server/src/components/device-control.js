import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ThermostatHeatMap from './thermostat-heat-map';
import classNames from 'classnames';
import { faSync } from '@fortawesome/free-solid-svg-icons';

export default function DeviceControl({ icon, iconOnClick = (e) => e.preventDefault(), actionPending = false, colorIconBackground, color, device, values = [], showMap }) {
  return (
    <>
      <div className="device-control__header">
        <a className={classNames('device-control__icon-container', actionPending && 'device-control__icon-container--disabled')} style={{ backgroundColor: colorIconBackground ? color + '50' : 'transparent' }} onClick={iconOnClick} href="#">
          <FontAwesomeIcon icon={actionPending ? faSync : icon} spin={actionPending} color={color} />
        </a>
        <div className="device-control__body">
          <h4 className="device-control__name">{device.name}</h4>
          <ul className="device-control__values">
            {values.map((value, idx) => <li className="device-control__value" key={idx}>{value}</li>)}
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