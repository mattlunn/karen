import React from 'react';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';
import styles from './device.module.css';

import type { DeviceApiResponse } from '../../api/types';
import { DateRangeProvider, DateRangeSelector } from '../date-range';
import { DeviceGraph } from '../capability-graphs/device-graph';
import { TimelineSection } from '../timeline/timeline-section';
import { Box, Grid, Paper, SimpleGrid, Title } from '@mantine/core';
import PageLoader from '../page-loader';
import { StatusItem } from '../status-item';
import dayjs from '../../dayjs';
import { humanDate } from '../../helpers/date';
import { getDeviceMetrics, getDeviceGraphs } from '../capabilities/registry';

export default function Device({ match: { params: { id }}} : RouteComponentProps<{ id: string }>) {
  const { loading, data } = useApiCall<DeviceApiResponse>(`/device/${id}`);

  if (loading || !data) {
    return <PageLoader />;
  }

  const device = data.device;
  const lastSeen = dayjs(device.lastSeen);
  const metrics = getDeviceMetrics(device);
  const graphs = getDeviceGraphs(device);

  return (
    <>
      <Title order={2}>{device.name}</Title>
      <DateRangeProvider>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 8 }}>
            <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }}>
              {metrics.map((metric, idx) => (
                <StatusItem
                  key={idx}
                  icon={metric.icon}
                  title={metric.title}
                  value={metric.value}
                  since={metric.since}
                  lastReported={metric.lastReported}
                  iconColor={metric.iconColor}
                  onIconClick={metric.onIconClick}
                />
              ))}
            </SimpleGrid>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Paper className={styles.info} withBorder p="md" radius="md">
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

        {graphs.length > 0 && (
          <div>
            <Title order={3} className={styles.sectionHeader}>Graph</Title>

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
                overridePageDateRange={graph.overridePreset}
                overridePageDateRangeStart={graph.overrideStart}
                overridePageDateRangeEnd={graph.overrideEnd}
              />
            ))}
          </div>
        )}

        <div>
          <TimelineSection deviceId={device.id} />
        </div>
      </DateRangeProvider>
    </>
  );
}
