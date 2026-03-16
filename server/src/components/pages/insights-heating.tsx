import React, { useMemo } from 'react';
import { Box, Title } from '@mantine/core';
import useApiCall from '../../hooks/api';
import { DateRangeProvider, DateRangeSelector, useDateRange } from '../date-range';
import { CapabilityGraph } from '../capability-graphs/capability-graph';
import { HeatingInsightsApiResponse } from '../../api/types';
import PageLoader from '../page-loader';

function HeatingDemandGraph() {
  const { globalRange } = useDateRange();

  const params = useMemo(() => ({
    since: globalRange.since.toISOString(),
    until: globalRange.until.toISOString()
  }), [globalRange.since, globalRange.until]);

  const { data, loading, error } = useApiCall<HeatingInsightsApiResponse>(
    '/insights/heating',
    params
  );

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return <Box style={{ height: '600px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Error loading data</Box>;
  }

  if (!data) {
    return null;
  }

  return (
    <CapabilityGraph
      lines={data.lines}
      modes={data.modes}
      yAxis={{
        yPercentage: {
          position: 'left',
          min: 0,
          max: 100
        }
      }}
    />
  );
}

export default function InsightsHeating() {
  return (
    <>
      <Title order={2}>Heating</Title>
      <DateRangeProvider>
        <Box mt="md">
          <DateRangeSelector />
        </Box>

        <Title order={4} mt="lg">Heating Demand</Title>
        <HeatingDemandGraph />
      </DateRangeProvider>
    </>
  );
}
