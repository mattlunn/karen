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
import { DeviceGraph } from '../capability-graphs/device-graph';
import { TimelineSection } from '../timeline/timeline-section';
import dayjs from '../../dayjs';
import { humanDate } from '../../helpers/date';
import { Box } from '@mantine/core';

function formatSince(isoString: string): string {
  const date = dayjs(isoString);
  return `since ${date.format('HH:mm')} ${humanDate(date)}`;
}

function StatusItem({ icon, title, value, since, color }: { icon: IconDefinition; title: string; value: string; since?: string; color?: string }) {
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
        {since && <div className="device__status-item-since">{formatSince(since)}</div>}
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
                  if (!capability.currentTemperature) return null;
                  return (
                    <StatusItem
                      key={idx}
                      icon={faThermometerQuarter}
                      title="Current Temperature"
                      value={`${capability.currentTemperature.value.toFixed(1)}°C`}
                      since={capability.currentTemperature.start}
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
                      value={`${capability.humidity.value}%`}
                      since={capability.humidity.start}
                      color="#04A7F4"
                    />
                  );
                }

                case 'THERMOSTAT': {
                  return [(
                      <StatusItem
                        key={`${idx}-target`}
                        icon={faThermometerQuarter}
                        title="Target Temperature"
                        value={`${capability.targetTemperature.value.toFixed(1)}°C`}
                        since={capability.targetTemperature.start}
                        color="#ff6f22"
                      />
                    ), (
                      <StatusItem
                        key={`${idx}-power`}
                        icon={faFire}
                        title="Power"
                        value={`${capability.power.value}%`}
                        since={capability.power.start}
                        color="#ff6f22"
                      />
                    )
                  ];
                }

                case 'LIGHT': {
                  return [(
                    <StatusItem
                      key={`${idx}-brightness`}
                      icon={faLightbulb}
                      title="Brightness"
                      value={`${capability.brightness.value}%`}
                      since={capability.brightness.start}
                    />
                  ), (
                    <StatusItem
                      key={`${idx}-status`}
                      icon={faCircleHalfStroke}
                      title="Status"
                      value="On"
                      since={capability.isOn.start}
                    />
                  )];
                }

                case 'MOTION_SENSOR': {
                  return (
                    <StatusItem
                      key={idx}
                      icon={faPersonWalking}
                      title="Status"
                      value="Motion"
                      since={capability.hasMotion.start}
                    />
                  );
                }

                case 'LIGHT_SENSOR': {
                  return (
                    <StatusItem
                      key={idx}
                      icon={faLightbulb}
                      title="Illuminance"
                      value={`${capability.illuminance.value} lx`}
                      since={capability.illuminance.start}
                    />
                  );
                }

                case 'HEAT_PUMP': {
                  return [
                    <StatusItem key={`${idx}-dhwcop`} icon={faFaucet} title="Hot Water CoP" value={`${capability.dHWCoP.value.toFixed(1)} CoP`} since={capability.dHWCoP.start} />,
                    <StatusItem key={`${idx}-heatingcop`} icon={faFire} title="Heating CoP" value={`${capability.heatingCoP.value.toFixed(1)} CoP`} since={capability.heatingCoP.start} />,
                    <StatusItem key={`${idx}-outside`} icon={faTree} title="Outside Temperature" value={`${capability.outsideTemperature.value.toFixed(1)}°C`} since={capability.outsideTemperature.start} />,
                    <StatusItem key={`${idx}-dhw`} icon={faFaucetDrip} title="Hot Water Temperature" value={`${capability.dHWTemperature.value.toFixed(1)}°C`} since={capability.dHWTemperature.start} />,
                    <StatusItem key={`${idx}-yield`} icon={faFire} title="Daily Yield" value={`${capability.totalDailyYield.value}kWh`} since={capability.totalDailyYield.start} />,
                    <StatusItem key={`${idx}-flow`} icon={faThermometer4} title="Flow Temperature" value={`${capability.actualFlowTemperature.value.toFixed(1)}°C`} since={capability.actualFlowTemperature.start} />,
                    <StatusItem key={`${idx}-return`} icon={faThermometer2} title="Return Temperature" value={`${capability.returnTemperature.value.toFixed(1)}°C`} since={capability.returnTemperature.start} />,
                    <StatusItem key={`${idx}-pressure`} icon={faGauge} title="System Pressure" value={`${capability.systemPressure.value.toFixed(1)} bar`} since={capability.systemPressure.start} />
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

      <Box mt="md">
        <DateRangeSelector />
      </Box>

      <div className="device__graph">
        <h3 className="device__section-header">Graph</h3>

        {hasCapability('THERMOSTAT') && (
          <DeviceGraph
            title="Temperature &amp; Power"
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
            <DeviceGraph title="Power" graphId="heatpump-power" deviceId={device.id} />
            <DeviceGraph title="Outside Temperature" graphId="heatpump-outside-temp" deviceId={device.id} yMin={-10} />
            <DeviceGraph title="DHW Temperature" graphId="heatpump-dhw-temp" deviceId={device.id} />
            <DeviceGraph title="Flow/ Return Temperatures" graphId="heatpump-flow-temp" deviceId={device.id} />
            <DeviceGraph
              title="System Pressure"
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
          <DeviceGraph title="Activity" graphId="light" deviceId={device.id} />
        )}
      </div>

      <div className="device__timeline">
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
