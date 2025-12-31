import React, { ReactNode } from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThermometerQuarter, faDroplet, IconDefinition, faFire, faLightbulb, faCircleHalfStroke, faPersonWalking, faFaucetDrip, faFireBurner, faFaucet, faTree, faThermometer1, faThermometer2, faThermometer4 } from '@fortawesome/free-solid-svg-icons';

import type { DeviceApiResponse, CapabilityApiResponse, NumericEventApiResponse, BooleanEventApiResponse } from '../../api/types';
import Event from '../event';
import { HeatPumpCapabilityGraph, ThermostatCapabilityGraph } from '../device-graph';

type TimelineEvent = {
  timestamp: Date;
  component: ReactNode;
};

function renderTimeline(events: ((TimelineEvent | null)[][])[]): ReactNode {
  const flattenedEvents = events.flat(2).filter(e => e !== null) as TimelineEvent[];
  const days: { date: moment.Moment; events: ReactNode[] }[] = [];
  
  flattenedEvents.toSorted((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  }).forEach((event) => {
    const eventMoment = moment(event.timestamp);
    const isSameDay = days.length > 0 && days[0].date.isSame(eventMoment, 'day');

    if (isSameDay) {
      days[0].events.unshift(event.component);
    } else {
      days.unshift({
        date: eventMoment.startOf('day'),
        events: [event.component]
      });
    }
  });

  return (
    <ol className='timeline'>
      {days.map(({ date, events }, idx) => {
        return (
          <li key={idx} className='day'>
            <h4 className='day__header'>{date.format('dddd, MMMM Do YYYY')}</h4>

              <ol className='events'>
              {events.map((event, idx) => {
                return (
                  <li className='event' key={idx}>
                    {event}
                  </li>
                );
              })}
            </ol>
          </li>
        );
      })}
    </ol>
  );
}

function extractRecentNumericHistory(history: NumericEventApiResponse[], formatValue: (value: number) => string) {
  if (history.length === 0) {
    return { value: 'N/A' };
  }

  const recentEvent = history[0];

  return { value: formatValue(recentEvent.value), since: recentEvent.start };
}

function extractRecentBooleanHistory(history: BooleanEventApiResponse[], formatValue: (value: boolean) => string) {
  if (history.length === 0) {
    return { value: 'N/A' };
  }

  const recentEvent = history[0];

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
                        <StatusItem icon={faThermometerQuarter} title="Current Temperature" {...extractRecentNumericHistory(capability.currentTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} color="#ff6f22" />
                      ]);
                    }

                    case 'HUMIDITY_SENSOR': {
                      return ([
                        <StatusItem icon={faDroplet} title="Humidity" {...extractRecentNumericHistory(capability.humidityHistory, (value) => `${value}%`)} color="#04A7F4" />
                      ]);
                    }

                    case 'THERMOSTAT': {
                      return ([
                        <StatusItem icon={faThermometerQuarter} title="Target Temperature" {...extractRecentNumericHistory(capability.targetTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} color="#ff6f22" />,
                        <StatusItem icon={faFire} title="Power" {...extractRecentNumericHistory(capability.powerHistory, (value) => `${value}%`)} color="#ff6f22" />
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
                        <StatusItem icon={faPersonWalking} title="Status" {...extractRecentBooleanHistory(capability.hasMotionHistory, isOn => isOn ? 'Motion' : 'No Motion')} />
                      ]);
                    }

                    case 'LIGHT_SENSOR': {
                      return ([
                        <StatusItem icon={faLightbulb} title="Illuminance" {...extractRecentNumericHistory(capability.illuminanceHistory, (value) => `${value} lx`)} />
                      ]);
                    }

                    case 'HEAT_PUMP': {
                      return ([
                        <StatusItem icon={faFaucet} title="Hot Water CoP" value={`${capability.dHWCoP.toFixed(1)} CoP`} />,
                        <StatusItem icon={faFire} title="Heating CoP" value={`${capability.heatingCoP.toFixed(1)} CoP`} />,
                        <StatusItem icon={faTree} title="Outside Temperature" {...extractRecentNumericHistory(capability.outsideTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} />,
                        <StatusItem icon={faFaucetDrip} title="Hot Water Temperature" {...extractRecentNumericHistory(capability.dHWTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} />,
                        <StatusItem icon={faFireBurner} title="Daily Yield" value={`${capability.totalDailyYield}kWh`} />,
                        <StatusItem icon={faThermometer4} title="Flow Temperature" {...extractRecentNumericHistory(capability.actualFlowTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} />,
                        <StatusItem icon={faThermometer2} title="Return Temperature" {...extractRecentNumericHistory(capability.returnTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} />,
                        <StatusItem icon={faThermometer2} title="System Pressure" {...extractRecentNumericHistory(capability.returnTemperatureHistory, (value) => `${value.toFixed(1)}°C`)} />,
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
          <div className="device__graph">
            <h3 className="device__section-header">Graph</h3>

            {device.capabilities.map((capability: CapabilityApiResponse) => {
              switch (capability.type) {
                case 'THERMOSTAT': {
                  return (<ThermostatCapabilityGraph response={data} />);
                }

                case 'HEAT_PUMP': {
                  return <HeatPumpCapabilityGraph response={data} />;
                }
              }
            }).flat()}
          </div>
          <div className="device__timeline">
            <h3 className="device__section-header">Timeline</h3>

            {renderTimeline(device.capabilities.map((capability: CapabilityApiResponse) => {
              switch (capability.type) {
                case 'LIGHT': {
                  return capability.isOnHistory.map((event) => {
                    return [{
                      timestamp: new Date(event.start),
                      component: (
                        <Event icon={faLightbulb} title="Light turned on" timestamp={event.start} />
                      )
                    }, event.end ? {
                      timestamp: new Date(event.end),
                      component: (
                        <Event icon={faLightbulb} title="Light turned off" timestamp={event.end} />
                      )
                    } : null];
                  });
                };

                case 'MOTION_SENSOR': {
                  return capability.hasMotionHistory.map((event) => {
                    return [{
                      timestamp: new Date(event.start),
                      component: (
                        <Event icon={faPersonWalking} title="Motion detected" timestamp={event.start} />
                      )
                    }, event.end ? {
                      timestamp: new Date(event.end),
                      component: (
                        <Event icon={faPersonWalking} title="Motion ended" timestamp={event.end} />
                      )
                    } : null];
                  });
                }

                default: {
                  return [];
                }
              }
            }))}
          </div>
        </div>
      </div>
    </div>
  );
}