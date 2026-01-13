import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faThermometerQuarter,
  faDroplet,
  IconDefinition,
  faFire,
  faLightbulb,
  faCircleHalfStroke,
  faPersonWalking,
  faFaucetDrip,
  faFaucet,
  faTree,
  faThermometer2,
  faThermometer4,
  faGauge
} from '@fortawesome/free-solid-svg-icons';

import type { DeviceApiResponse, CapabilityApiResponse } from '../../api/types';
import { DateRangeProvider, DateRangeSelector } from '../date-range';
import { DeviceGraph } from '../capability-graphs/DeviceGraph';
import { TimelineSection } from '../timeline/TimelineSection';

function StatusItem({ icon, title, value, color }: { icon: IconDefinition; title: string; value: string; color?: string }) {
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
      </div>
    </li>
  );
}

function DeviceContent({ device }: { device: DeviceApiResponse['device'] }) {
  const hasCapability = (type: string) => device.capabilities.some(c => c.type === type);

  return (
    <>
      <div className="device__top">
        <div className="device__status">
          <ul>
            {device.capabilities.map((capability: CapabilityApiResponse, idx: number) => {
              switch (capability.type) {
                case 'TEMPERATURE_SENSOR': {
                  return (
                    <StatusItem
                      key={idx}
                      icon={faThermometerQuarter}
                      title="Current Temperature"
                      value={`${capability.currentTemperature.toFixed(1)}°C`}
                      color="#ff6f22"
                    />
                  );
                }

                case 'HUMIDITY_SENSOR': {
                  return (
                    <StatusItem
                      key={idx}
                      icon={faDroplet}
                      title="Humidity"
                      value={`${capability.humidity}%`}
                      color="#04A7F4"
                    />
                  );
                }

                case 'THERMOSTAT': {
                  return [
                    <StatusItem
                      key={`${idx}-target`}
                      icon={faThermometerQuarter}
                      title="Target Temperature"
                      value={`${capability.targetTemperature.toFixed(1)}°C`}
                      color="#ff6f22"
                    />,
                    <StatusItem
                      key={`${idx}-power`}
                      icon={faFire}
                      title="Power"
                      value={`${capability.power}%`}
                      color="#ff6f22"
                    />
                  ];
                }

                case 'LIGHT': {
                  return [
                    <StatusItem
                      key={`${idx}-brightness`}
                      icon={faLightbulb}
                      title="Brightness"
                      value={`${capability.brightness}%`}
                    />,
                    <StatusItem
                      key={`${idx}-status`}
                      icon={faCircleHalfStroke}
                      title="Status"
                      value={capability.isOn ? 'On' : 'Off'}
                    />
                  ];
                }

                case 'MOTION_SENSOR': {
                  return (
                    <StatusItem
                      key={idx}
                      icon={faPersonWalking}
                      title="Status"
                      value={capability.hasMotion ? 'Motion' : 'No Motion'}
                    />
                  );
                }

                case 'LIGHT_SENSOR': {
                  return (
                    <StatusItem
                      key={idx}
                      icon={faLightbulb}
                      title="Illuminance"
                      value={`${capability.illuminance} lx`}
                    />
                  );
                }

                case 'HEAT_PUMP': {
                  return [
                    <StatusItem key={`${idx}-dhwcop`} icon={faFaucet} title="Hot Water CoP" value={`${capability.dHWCoP.toFixed(1)} CoP`} />,
                    <StatusItem key={`${idx}-heatingcop`} icon={faFire} title="Heating CoP" value={`${capability.heatingCoP.toFixed(1)} CoP`} />,
                    <StatusItem key={`${idx}-outside`} icon={faTree} title="Outside Temperature" value={`${capability.outsideTemperature.toFixed(1)}°C`} />,
                    <StatusItem key={`${idx}-dhw`} icon={faFaucetDrip} title="Hot Water Temperature" value={`${capability.dHWTemperature.toFixed(1)}°C`} />,
                    <StatusItem key={`${idx}-yield`} icon={faFire} title="Daily Yield" value={`${capability.totalDailyYield}kWh`} />,
                    <StatusItem key={`${idx}-flow`} icon={faThermometer4} title="Flow Temperature" value={`${capability.actualFlowTemperature.toFixed(1)}°C`} />,
                    <StatusItem key={`${idx}-return`} icon={faThermometer2} title="Return Temperature" value={`${capability.returnTemperature.toFixed(1)}°C`} />,
                    <StatusItem key={`${idx}-pressure`} icon={faGauge} title="System Pressure" value={`${capability.systemPressure.toFixed(1)} bar`} />
                  ];
                }

                default:
                  return null;
              }
            }).flat()}
          </ul>
        </div>
        <div className="device__info">
          <dl>
            <dt>Provider</dt>
            <dd>{device.provider}</dd>
            <dt>Provider Identifier</dt>
            <dd>{device.providerId}</dd>
            <dt>Manufacturer</dt>
            <dd>N/A</dd>
            <dt>Model</dt>
            <dd>N/A</dd>
          </dl>
        </div>
      </div>

      <DateRangeSelector />

      <div className="device__graph">
        <h3 className="device__section-header">Graph</h3>

        {hasCapability('THERMOSTAT') && (
          <DeviceGraph
            graphId="thermostat"
            deviceId={device.id}
            yAxis={{
              yTemperature: { position: 'left', min: 0, max: 30 },
              yPercentage: { position: 'right', min: 0, max: 100 }
            }}
          />
        )}

        {hasCapability('HEAT_PUMP') && (
          <>
            <DeviceGraph graphId="heatpump-power" deviceId={device.id} />
            <DeviceGraph graphId="heatpump-outside-temp" deviceId={device.id} yMin={-10} />
            <DeviceGraph graphId="heatpump-dhw-temp" deviceId={device.id} />
            <DeviceGraph graphId="heatpump-flow-temp" deviceId={device.id} />
            <DeviceGraph
              graphId="heatpump-pressure"
              deviceId={device.id}
              zones={[
                { min: 0, max: 1, color: 'rgba(255, 0, 55, 0.25)' },
                { min: 1, max: 2, color: 'rgba(31, 135, 0, 0.25)' }
              ]}
              yMin={0}
              yMax={2}
            />
          </>
        )}

        {hasCapability('LIGHT') && (
          <DeviceGraph graphId="light" deviceId={device.id} />
        )}
      </div>

      <div className="device__timeline">
        <h3 className="device__section-header">Timeline</h3>
        <TimelineSection deviceId={device.id} />
      </div>
    </>
  );
}

export default function Device({ match: { params: { id }}} : RouteComponentProps<{ id: string }>) {
  const { loading, data } = useApiCall<DeviceApiResponse>(`/device/${id}`);

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
          <DateRangeProvider>
            <DeviceContent device={device} />
          </DateRangeProvider>
        </div>
      </div>
    </div>
  );
}
