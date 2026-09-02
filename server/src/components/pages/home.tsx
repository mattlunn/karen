import React from 'react';
import { useMediaQuery } from '@mantine/hooks';
import Security from '../security';
import Groups from '../groups';
import HouseStatus from '../house-status';
import PageLoader from '../page-loader';
import { useDevices } from '../../hooks/queries/use-devices';
import { useCameraDevices } from '../../hooks/queries/use-camera-devices';

export default function Home() {
  const { data, isLoading } = useDevices();
  const { cameras } = useCameraDevices();
  const isDesktop = useMediaQuery('(min-width: 62em)');

  if (isLoading || !data) {
    return <PageLoader />;
  }

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
