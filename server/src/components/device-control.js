import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ThermostatHeatMap from './thermostat-heat-map';
import classNames from 'classnames';
import { faBatteryEmpty, faSync } from '@fortawesome/free-solid-svg-icons';

function getIsBatteryLow(device) {
  const batteryLowCapability = device.capabilities.find(x => x.type === 'BATTERY_LOW_INDICATOR');

  if (batteryLowCapability) {
    return batteryLowCapability.isLow.value;
  }

  return false;
}

export default function DeviceControl({ icon, iconOnClick = (e) => e.preventDefault(), actionPending = false, colorIconBackground, color, device, values = [], showMap }) {
  const isBatteryLow = getIsBatteryLow(device);

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
            
            {isBatteryLow && (
              <li className="device-control__value device-control__value--warning">
                <FontAwesomeIcon icon={faBatteryEmpty} color="red" />
              </li>
            )}
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