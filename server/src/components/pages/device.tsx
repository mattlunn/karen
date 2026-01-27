import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';

import type { DeviceApiResponse, CapabilityApiResponse } from '../../api/types';
import { DateRangeProvider, DateRangeSelector } from '../date-range';
import { DeviceGraph } from '../capability-graphs/device-graph';
import { TimelineSection } from '../timeline/timeline-section';
import { Box, Grid, Paper, SimpleGrid } from '@mantine/core';
import { StatusItem } from '../status-item';
import { getCapabilityConfig, getDeviceGraphs } from '../capabilities/registry';
import type { CapabilityType } from '../capabilities/types';

function DeviceContent({ device }: { device: DeviceApiResponse['device'] }) {
  const graphs = getDeviceGraphs(device.capabilities);

  return (
    <>
      <Grid>
        <Grid.Col span={8}>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {device.capabilities.map((capability: CapabilityApiResponse, idx: number) => {
              if (capability.type === null) return null;

              const config = getCapabilityConfig(capability.type as CapabilityType);
              const statusItems = config.getStatusItems(capability as never, device);

              return statusItems.map((item, itemIdx) => (
                <StatusItem
                  key={`${idx}-${itemIdx}`}
                  icon={item.icon}
                  title={item.title}
                  value={item.value}
                  since={item.since}
                  lastReported={item.lastReported}
                  color={item.color}
                />
              ));
            }).flat()}
          </SimpleGrid>
        </Grid.Col>
        <Grid.Col span={4}>
          <Paper className="device__info" withBorder p="md" radius="md" h="100%">
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
          </Paper>
        </Grid.Col>
      </Grid>

      <Box mt="md">
        <DateRangeSelector />
      </Box>

      <div className="device__graph">
        <h3 className="device__section-header">Graph</h3>

        {graphs.map((graph) => (
          <DeviceGraph
            key={graph.id}
            title={graph.title}
            graphId={graph.id}
            deviceId={device.id}
            yAxis={graph.yAxis}
            yMin={graph.yMin}
            yMax={graph.yMax}
            zones={graph.zones}
          />
        ))}
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
