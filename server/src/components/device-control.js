import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ThermostatHeatMap from './thermostat-heat-map';

export default function DeviceControl({ icon, color, device, values = () => [], showMap }) {
  return (
    <>
      <div className="device-control__header">
        <div className="device-control__icon-container" style={{ backgroundColor: color + '50' }}>
          <FontAwesomeIcon icon={icon} color={color} />
        </div>
        <div className="device-control__body">
          <h4 className="device-control__name">{device.name}</h4>
          <ul className="device-control__values">
            {values(device).map(value => <li className="device-control__value">{value}</li>)}
          </ul>
        </div>
      </div>
      <div className="device-control__footer">
        {showMap && <ThermostatHeatMap activity={activity} withHours={false} colorMask={color} />}
      </div>
    </>
  );
}