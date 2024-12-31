import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import ThermostatHeatMap from './thermostat-heat-map';
import { useMutation } from '@apollo/client';
import gql from 'graphql-tag';
import classNames from 'classnames';
import { faSync } from '@fortawesome/free-solid-svg-icons';

export default function DeviceControl({ icon, color, device, values = () => [], showMap }) {
  const [setLightSwitchStatus, { loading }] = useMutation(gql`
    mutation updateLight($id: ID!, $isOn: Boolean) {
      updateLight(id: $id, isOn: $isOn) {
        id
        name
        isOn
      }
    }
  `);

  return (
    <>
      <div className="device-control__header">
        <a className={classNames('device-control__icon-container', loading && 'device-control__icon-container--disabled')} style={{ backgroundColor: color + '50' }} onClick={(e) => {
          e.preventDefault();

          if (loading) return;

          switch (device.__typename) {
            case 'Light':
              setLightSwitchStatus({
                variables: {
                  id: device.id,
                  isOn: !device.isOn
                }
              });
          }
        }} href="#">
          <FontAwesomeIcon icon={loading ? faSync : icon} spin={loading} color={color} />
        </a>
        <div className="device-control__body">
          <h4 className="device-control__name">{device.name}</h4>
          <ul className="device-control__values">
            {values(device).map((value, idx) => <li className="device-control__value" key={idx}>{value}</li>)}
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