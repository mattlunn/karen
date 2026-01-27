import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ThermostatHeatMap from './thermostat-heat-map';
import classNames from 'classnames';
import { faSync } from '@fortawesome/free-solid-svg-icons';
import { Indicator } from '@mantine/core';

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

export default function DeviceControl({ icon, iconOnClick = (e) => e.preventDefault(), actionPending = false, colorIconBackground, color, device, values = [], showMap }) {
  const isBatteryLow = getIsBatteryLow(device);

  return (
    <>
      <div className="device-control__header">
        <Indicator color="red" disabled={!isBatteryLow} size={12} offset={4}>
          <a className={classNames('device-control__icon-container', actionPending && 'device-control__icon-container--disabled')} style={{ backgroundColor: colorIconBackground ? color + '50' : 'transparent' }} onClick={iconOnClick} href="#">
            <FontAwesomeIcon icon={actionPending ? faSync : icon} spin={actionPending} color={color} />
          </a>
        </Indicator>
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