import React from 'react';
import Security from '../security';
import Groups from '../groups';
import PageContent from '../page-content';
import { useDevices } from '../../hooks/queries/use-devices';

export default function Home() {
  const { data, isLoading } = useDevices();

  return (
    <PageContent loading={isLoading} data={data}>
      {(data) => {
        const cameras = data.devices.reduce((acc, device) => {
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
            <Security cameras={cameras} />
            <Groups
              rooms={data.rooms}
              devices={data.devices}
              loading={isLoading}
            />
          </>
        );
      }}
    </PageContent>
  );
}
