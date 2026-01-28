import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faThermometerQuarter } from '@fortawesome/free-solid-svg-icons/faThermometerQuarter';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faBatteryEmpty, faSignal } from '@fortawesome/free-solid-svg-icons';
import { Link } from 'react-router-dom';
import { Anchor, Table } from '@mantine/core';
import useApiCall from '../../hooks/api';

function getDeviceIcon(capabilities) {
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

function getIsBatteryLow(device) {
  const batteryLowCapability = device.capabilities.find(x => x.type === 'BATTERY_LOW_INDICATOR');

  if (batteryLowCapability) {
    return batteryLowCapability.isLow.value;
  }

  return false;
}

function formatLastSeen(lastSeen) {
  const date = new Date(lastSeen);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins === 1 ? '' : 's'} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

function IssuesIndicator({ device }) {
  const issues = [];

  // Check if lastSeen > 1 hour
  const lastSeenDate = new Date(device.lastSeen);
  const hourAgo = new Date(Date.now() - 3600000);
  if (lastSeenDate < hourAgo) {
    issues.push(<FontAwesomeIcon key="signal" icon={faSignal} color="red" title="Not seen recently" />);
  }

  // Check for low battery
  if (getIsBatteryLow(device)) {
    issues.push(<FontAwesomeIcon key="battery" icon={faBatteryEmpty} color="red" title="Battery Low" />);
  }

  if (issues.length === 0) {
    return null;
  }

  return (
    <span style={{ display: 'flex', gap: '8px' }}>
      {issues}
    </span>
  );
}

function DevicesTable({ devices }) {
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
  const { data, loading } = useApiCall('/devices');

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
    .reduce((acc, device) => {
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
