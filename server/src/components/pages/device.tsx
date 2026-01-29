import React from 'react';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';
import {
  faThermometerQuarter,
  faDroplet,
  faFire,
  faLightbulb,
  faCircleHalfStroke,
  faPersonWalking,
  faFaucetDrip,
  faFaucet,
  faTree,
  faThermometer2,
  faThermometer4,
  faGauge,
  faBatteryFull,
  faBatteryHalf,
  faBatteryQuarter,
  faBatteryEmpty
} from '@fortawesome/free-solid-svg-icons';

import type { DeviceApiResponse, CapabilityApiResponse } from '../../api/types';
import { DateRangeProvider, DateRangeSelector } from '../date-range';
import { DeviceGraph } from '../capability-graphs/device-graph';
import { TimelineSection } from '../timeline/timeline-section';
import { Box, Grid, Paper, SimpleGrid } from '@mantine/core';
import { StatusItem } from '../status-item';
import dayjs from '../../dayjs';
import { humanDate } from '../../helpers/date';

function DeviceContent({ device }: { device: DeviceApiResponse['device'] }) {
  const hasCapability = (type: string) => device.capabilities.some(c => c.type === type);
  const lastSeen = dayjs(device.lastSeen);

  return (
    <>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
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
                      lastReported={capability.currentTemperature.lastReported}
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
                      lastReported={capability.humidity.lastReported}
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
                        lastReported={capability.targetTemperature.lastReported}
                        color="#ff6f22"
                      />
                    ), (
                      <StatusItem
                        key={`${idx}-power`}
                        icon={faFire}
                        title="Power"
                        value={`${capability.power.value}%`}
                        since={capability.power.start}
                        lastReported={capability.power.lastReported}
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
                      lastReported={capability.brightness.lastReported}
                    />
                  ), (
                    <StatusItem
                      key={`${idx}-status`}
                      icon={faCircleHalfStroke}
                      title="Status"
                      value="On"
                      since={capability.isOn.start}
                      lastReported={capability.isOn.lastReported}
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
                      lastReported={capability.hasMotion.lastReported}
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
                      lastReported={capability.illuminance.lastReported}
                    />
                  );
                }

                case 'HEAT_PUMP': {
                  return [
                    <StatusItem key={`${idx}-dhwcop`} icon={faFaucet} title="Hot Water CoP" value={`${capability.dHWCoP.value.toFixed(1)} CoP`} since={capability.dHWCoP.start} lastReported={capability.dHWCoP.lastReported} />,
                    <StatusItem key={`${idx}-heatingcop`} icon={faFire} title="Heating CoP" value={`${capability.heatingCoP.value.toFixed(1)} CoP`} since={capability.heatingCoP.start} lastReported={capability.heatingCoP.lastReported} />,
                    <StatusItem key={`${idx}-outside`} icon={faTree} title="Outside Temperature" value={`${capability.outsideTemperature.value.toFixed(1)}°C`} since={capability.outsideTemperature.start} lastReported={capability.outsideTemperature.lastReported} />,
                    <StatusItem key={`${idx}-dhw`} icon={faFaucetDrip} title="Hot Water Temperature" value={`${capability.dhwTemperature.value.toFixed(1)}°C`} since={capability.dhwTemperature.start} lastReported={capability.dhwTemperature.lastReported} />,
                    <StatusItem key={`${idx}-yield`} icon={faFire} title="Daily Yield" value={`${capability.dailyConsumedEnergy.value}kWh`} since={capability.dailyConsumedEnergy.start} lastReported={capability.dailyConsumedEnergy.lastReported} />,
                    <StatusItem key={`${idx}-flow`} icon={faThermometer4} title="Flow Temperature" value={`${capability.actualFlowTemperature.value.toFixed(1)}°C`} since={capability.actualFlowTemperature.start} lastReported={capability.actualFlowTemperature.lastReported} />,
                    <StatusItem key={`${idx}-return`} icon={faThermometer2} title="Return Temperature" value={`${capability.returnTemperature.value.toFixed(1)}°C`} since={capability.returnTemperature.start} lastReported={capability.returnTemperature.lastReported} />,
                    <StatusItem key={`${idx}-pressure`} icon={faGauge} title="System Pressure" value={`${capability.systemPressure.value.toFixed(1)} bar`} since={capability.systemPressure.start} lastReported={capability.systemPressure.lastReported} />
                  ];
                }

                case 'BATTERY_LEVEL_INDICATOR': {
                  const percentage = capability.batteryPercentage.value;
                  const getBatteryIcon = () => {
                    if (percentage > 75) return faBatteryFull;
                    if (percentage > 50) return faBatteryHalf;
                    if (percentage > 25) return faBatteryQuarter;
                    return faBatteryEmpty;
                  };
                  const getBatteryColor = () => {
                    if (percentage > 50) return '#2ecc71';
                    if (percentage > 25) return '#f39c12';
                    return '#e74c3c';
                  };
                  return (
                    <StatusItem
                      key={idx}
                      icon={getBatteryIcon()}
                      title="Battery"
                      value={`${percentage}%`}
                      since={capability.batteryPercentage.start}
                      lastReported={capability.batteryPercentage.lastReported}
                      color={getBatteryColor()}
                    />
                  );
                }

                case 'BATTERY_LOW_INDICATOR': {
                  const isLow = capability.isLow.value;
                  return (
                    <StatusItem
                      key={idx}
                      icon={isLow ? faBatteryEmpty : faBatteryFull}
                      title="Battery"
                      value={isLow ? 'LOW' : 'OK'}
                      since={capability.isLow.start}
                      lastReported={capability.isLow.lastReported}
                      color={isLow ? '#e74c3c' : '#2ecc71'}
                    />
                  );
                }

                default:
                  return null;
              }
            }).flat()}
          </SimpleGrid>
        </Grid.Col>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Paper className="device__info" withBorder p="md" radius="md">
            <dl>
              <dt>Manufacturer</dt>
              <dd>{device.manufacturer}</dd>
              <dt>Model</dt>
              <dd>{device.model}</dd>
              <dt>Provider</dt>
              <dd>{device.provider}</dd>
              <dt>Provider Identifier</dt>
              <dd>{device.providerId}</dd>
              <dt>Last Seen</dt>
              <dd>{`${lastSeen.format('HH:mm')} ${humanDate(lastSeen)}`}</dd>
            </dl>
          </Paper>
        </Grid.Col>
      </Grid>

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
    return (
      <div className='body body--with-padding'>
        <div className="loading-spinner" style={{ height: '200px' }} />
      </div>
    );
  }

  const { device } = data;

  return (
    <div className='body body--with-padding'>
      <h2>{device.name}</h2>
      <DateRangeProvider>
        <DeviceContent device={device} />
      </DateRangeProvider>
    </div>
  );
}
