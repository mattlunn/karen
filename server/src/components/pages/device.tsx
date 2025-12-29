import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';

import type { DeviceApiResponse, CapabilityApiResponse } from '../../api/types';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThermometerQuarter, faDroplet, IconDefinition, faFire, faLightbulb, faCircleHalfStroke } from '@fortawesome/free-solid-svg-icons';

function StatusItem({ icon, title, value, color }: { icon: IconDefinition; title: string; value: string, color?: string }) {
  return (
    <li className="device__status-item">
      <div className="device__status-item-icon">
        <FontAwesomeIcon icon={icon} color={color}/>
      </div>
      <div className="device__status-item-value">
        <dl>
          <dt className="device__status-item-value-title">{title}</dt>
          <dd className="device__status-item-value-value">{value}</dd>
        </dl> 
      </div>
    </li>
  );
}

export default function Device({ match: { params: { id }}} : RouteComponentProps<{ id: string }>) {
  const { loading, error, data } = useApiCall<DeviceApiResponse>(`/device/${id}`);

  if (loading || !data) {
    return <></>;
  }

  const { device } = data;

  return (
    <div>
      <Header />
      <div>
        <SideBar hideOnMobile />
        <div className='body body--with-padding'>
          <h2>{device.name}</h2>
          <div className="device__top">
            <div className="device__status">
              <ul>
                {device.capabilities.map((capability: CapabilityApiResponse) => {
                  switch (capability.type) {
                    case 'TEMPERATURE_SENSOR': {
                      return ([
                        <StatusItem icon={faThermometerQuarter} title="Current Temperature" value={`${capability.currentTemperature.toFixed(1)}°C`} color="#ff6f22" />
                      ]);
                    }

                    case 'HUMIDITY_SENSOR': {
                      return ([
                        <StatusItem icon={faDroplet} title="Humidity" value={`${capability.humidity}%`} color="#04A7F4" />
                      ]);
                    }

                    case 'THERMOSTAT': {
                      return ([
                        <StatusItem icon={faThermometerQuarter} title="Target Temperature" value={`${capability.targetTemperature.toFixed(1)}°C`} color="#ff6f22" />,
                        <StatusItem icon={faFire} title="Power" value={`${capability.power}%`} color="#ff6f22" />
                      ]);
                    }

                    case 'LIGHT': {
                      return ([
                        <StatusItem icon={faLightbulb} title="Brightness" value={`${capability.brightness}%`} />,
                        <StatusItem icon={faCircleHalfStroke} title="Status" value={capability.isOn ? 'On' : 'Off'} />
                      ]);
                    }
                  }
                }).flat()}
              </ul>
            </div>
            <div className="device__info">
              <dl>
                <dt>Provider</dt>
                <dd>{device.provider}</dd>
                <dt>Provider Identifer</dt>
                <dd>{device.providerId}</dd>
                <dt>Manufactuer</dt>
                <dd>N/A</dd>
                <dt>Model</dt>
                <dd>N/A</dd>
              </dl>
            </div>
          </div>
          <div>
            
          </div>
        </div>
      </div>
    </div>
  );
}