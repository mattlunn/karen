import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThermometerQuarter, faDroplet, IconDefinition, faFire, faLightbulb, faCircleHalfStroke, faPersonWalking } from '@fortawesome/free-solid-svg-icons';

import type { DeviceApiResponse, CapabilityApiResponse, NumericEventApiResponse, BooleanEventApiResponse } from '../../api/types';

function extractRecentNumericHistory(history: NumericEventApiResponse[], formatValue: (value: number) => string) {
  if (history.length === 0) {
    return { value: 'N/A' };
  }

  const recentEvent = history[history.length - 1];

  return { value: formatValue(recentEvent.value), since: recentEvent.start };
}

function extractRecentBooleanHistory(history: BooleanEventApiResponse[], formatValue: (value: boolean) => string) {
  if (history.length === 0) {
    return { value: 'N/A' };
  }

  const recentEvent = history[history.length - 1];

  return { value: formatValue(!recentEvent.end), since: recentEvent.end || recentEvent.start };
}

function StatusItem({ icon, title, value, color, since }: { icon: IconDefinition; title: string; value: string, color?: string, since?: string }) {
  const sinceMoment = moment(since);
  const sinceFormatted = sinceMoment.isSameOrAfter(moment().startOf('day')) 
    ? sinceMoment.format('HH:mm:ss')
    : sinceMoment.format('YYYY-MM-DD HH:mm:ss');

  return (
    <li className="device__status-item">
      <div className="device__status-item-title">
        {title}

        <div className="device__status-item-icon">
          <FontAwesomeIcon icon={icon} color={color}/>
        </div>
      </div>

      <div className="device__status-item-details">
        <div className="device__status-item-value">{value}</div>
        <div className="device__status-item-date">{sinceFormatted}</div>
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
                        <StatusItem icon={faLightbulb} title="Brightness" {...extractRecentNumericHistory(capability.brightnessHistory, (value) => `${value}%`)} />,
                        <StatusItem icon={faCircleHalfStroke} title="Status" {...extractRecentBooleanHistory(capability.isOnHistory, isOn => isOn ? 'On' : 'Off')} />
                      ]);
                    }

                    case 'MOTION_SENSOR': {
                      return ([
                        <StatusItem icon={faPersonWalking} title="Status" value={capability.hasMotion ? 'Motion' : 'No Motion'} />
                      ]);
                    }

                    case 'LIGHT_SENSOR': {
                      return ([
                        <StatusItem icon={faLightbulb} title="Illuminance" value={`${capability.illuminance} lx`} />
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
            <div className="device__timeline">
              <h3>Timeline</h3>

              {device.capabilities.map((capability: CapabilityApiResponse) => {
                switch (capability.type) {
                  case 'LIGHT': {
                    return capability.isOnHistory.map((event) => {
                    });
                  }
                }
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}