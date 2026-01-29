import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faThermometerQuarter } from '@fortawesome/free-solid-svg-icons/faThermometerQuarter';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { Link } from 'react-router-dom';
import { Anchor, Table } from '@mantine/core';
import useApiCall from '../../hooks/api';
import { dayjs } from '../../dayjs';
import { humanDate } from '../../helpers/date';
import IssuesIndicator from '../issues-indicator';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import type { CapabilityApiResponse, DevicesApiResponse, RestDeviceResponse } from '../../api/types';

function getDeviceIcon(capabilities: CapabilityApiResponse[]): IconDefinition {
  if (capabilities.some(x => x.type === 'CAMERA')) {
    return faVideo;
  }

  if (capabilities.some(x => x.type === 'THERMOSTAT')) {
    return faThermometerQuarter;
  }

  if (capabilities.some(x => x.type === 'LIGHT')) {
    return faLightbulb;
  }

  if (capabilities.some(x => x.type === 'MOTION_SENSOR')) {
    return faEye;
  }

  return faQuestion;
}

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

export default function Devices() {
  const { data, loading } = useApiCall<DevicesApiResponse>('/devices');

  if (loading || !data) {
    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body body--with-padding'>
            <h2>Devices</h2>
          </div>
        </div>
      </div>
    );
  }

  const { active, old } = (data.devices || [])
    .toSorted((a, b) => a.name.localeCompare(b.name))
    .reduce<{ active: RestDeviceResponse[]; old: RestDeviceResponse[] }>((acc, device) => {
      acc[device.status === 'OK' ? 'active' : 'old'].push(device);

      return acc;
    }, { active: [], old: [] });

  return (
    <div>
      <Header />
      <div>
        <SideBar hideOnMobile />
        <div className='body body--with-padding'>
          <h2>Devices</h2>

          <DevicesTable devices={active} />

          {old.length > 0 ? (
            <>
              <h3>Offline Devices</h3>
              <DevicesTable devices={old} />
            </>
          ) : null}

        </div>
      </div>
    </div>
  );
}
