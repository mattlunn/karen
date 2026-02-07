import React from 'react';
import { useMediaQuery } from '@mantine/hooks';
import Security from '../security';
import Groups from '../groups';
import HouseStatus from '../house-status';
import PageLoader from '../page-loader';
import { useDevices } from '../../hooks/queries/use-devices';

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

  const cameras: Camera[] = data.devices.reduce<Camera[]>((acc, device) => {
    const cameraCapability = device.capabilities.find(cap => cap.type === 'CAMERA');

    if (cameraCapability) {
      acc.push({
        id: device.id,
        name: device.name,
        snapshotUrl: cameraCapability.snapshotUrl.value
      });
    }

    return acc;
  }, []);

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
