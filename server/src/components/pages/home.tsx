import React from 'react';
import { useMediaQuery } from '@mantine/hooks';
import Security from '../security';
import Groups from '../groups';
import HouseStatus from '../house-status';
import PageLoader from '../page-loader';
import { useDevices } from '../../hooks/queries/use-devices';
import { forDeviceCapability } from '../../helpers/device';

interface Camera {
  id: number;
  name: string;
  snapshotUrl: string;
}

export default function Home() {
  const { data, isLoading } = useDevices();
  const isDesktop = useMediaQuery('(min-width: 62em)');

  if (isLoading || !data) {
    return <PageLoader />;
  }

  const cameras: Camera[] = forDeviceCapability(data.devices, 'CAMERA', (device, capability) => ({
    id: device.id,
    name: device.name,
    snapshotUrl: capability.snapshotUrl.value,
  }));

  return (
    <>
      {!isDesktop && <HouseStatus />}
      <Security cameras={cameras} />
      <Groups
        rooms={data.rooms}
        devices={data.devices}
        loading={isLoading}
      />
    </>
  );
}
