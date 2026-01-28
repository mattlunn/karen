import React from 'react';
import { Group } from '@mantine/core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBatteryEmpty, faSignal } from '@fortawesome/free-solid-svg-icons';
import type { RestDeviceResponse } from '../api/types';

export function getIsBatteryLow(device: RestDeviceResponse): boolean {
  const batteryLowCapability = device.capabilities.find(x => x.type === 'BATTERY_LOW_INDICATOR');

  if (batteryLowCapability) {
    return batteryLowCapability.isLow.value;
  }

  return false;
}

export default function IssuesIndicator({ device }: { device: RestDeviceResponse }) {
  const issues: React.ReactNode[] = [];

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
    <Group gap={8}>
      {issues}
    </Group>
  );
}
