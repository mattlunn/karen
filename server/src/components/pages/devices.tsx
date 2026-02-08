import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons/faExclamationTriangle';
import { Link } from 'react-router-dom';
import { Alert, Anchor, Table, Title } from '@mantine/core';
import PageLoader from '../page-loader';
import useApiCall from '../../hooks/api';
import dayjs from '../../dayjs';
import { humanDate } from '../../helpers/date';
import IssuesIndicator from '../issues-indicator';
import { getDeviceIcon } from '../capabilities/icons';
import type { DevicesApiResponse, BrokenDeviceResponse, RestDeviceResponse } from '../../api/types';

function formatLastSeen(lastSeen: string): string {
  const date = dayjs(lastSeen);

  return `${date.format('HH:mm')} ${humanDate(date)}`;
}

function DevicesTable({ devices }: { devices: RestDeviceResponse[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={1}></Table.Th>
          <Table.Th>Name</Table.Th>
          <Table.Th visibleFrom="sm">Manufacturer</Table.Th>
          <Table.Th>Model</Table.Th>
          <Table.Th>Last Seen</Table.Th>
          <Table.Th></Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {devices.map((device) => (
          <Table.Tr key={device.id}>
            <Table.Td>
              <Anchor component={Link} to={`/device/${device.id}`}>
                <FontAwesomeIcon icon={getDeviceIcon(device.capabilities)} />
              </Anchor>
            </Table.Td>
            <Table.Td>
              <Anchor component={Link} to={`/device/${device.id}`}>
                {device.name}
              </Anchor>
            </Table.Td>
            <Table.Td visibleFrom="sm">{device.manufacturer}</Table.Td>
            <Table.Td>{device.model}</Table.Td>
            <Table.Td>{formatLastSeen(device.lastSeen)}</Table.Td>
            <Table.Td><IssuesIndicator device={device} /></Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function BrokenDevicesTable({ devices }: { devices: BrokenDeviceResponse[] }) {
  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={1}></Table.Th>
          <Table.Th>Name</Table.Th>
          <Table.Th>Provider</Table.Th>
          <Table.Th>Provider ID</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {devices.map((device) => (
          <Table.Tr key={device.id}>
            <Table.Td>{device.id}</Table.Td>
            <Table.Td>
              <Anchor component={Link} to={`/device/${device.id}`}>
                {device.name}
              </Anchor>
            </Table.Td>
            <Table.Td>{device.provider}</Table.Td>
            <Table.Td>{device.providerId}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

export default function Devices() {
  const { data, loading } = useApiCall<DevicesApiResponse>('/devices');

  if (loading || !data) {
    return <PageLoader />;
  }

  const brokenDevices = data.brokenDevices;
  const { active, old } = data.devices
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .reduce<{ active: RestDeviceResponse[]; old: RestDeviceResponse[] }>((acc, device) => {
      acc[device.status === 'OK' ? 'active' : 'old'].push(device);

      return acc;
    }, { active: [], old: [] });

  return (
    <>
      <Title order={2}>Devices</Title>
      <DevicesTable devices={active} />

      {old.length > 0 ? (
        <>
          <Title order={3} mt="md">Offline Devices</Title>
          <DevicesTable devices={old} />
        </>
      ) : null}

      {brokenDevices.length > 0 ? (
        <>
          <Title order={3} mt="lg">Broken Devices</Title>
          <Alert
            variant="light"
            color="red"
            icon={<FontAwesomeIcon icon={faExclamationTriangle} />}
            mt="md"
            mb="md"
          >
            {`${brokenDevices.length} device(s) cannot be shown due to errors mapping their capabilities`}
          </Alert>
          <BrokenDevicesTable devices={brokenDevices} />
        </>
      ) : null}
    </>
  );
}
