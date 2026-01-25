import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import Security from '../security';
import Groups from '../groups';
import { useDevices } from '../../hooks/queries/use-devices';
import { useSSEEvents } from '../../hooks/use-sse-events';
import ConnectionStatus from '../connection-status';

export default function Home() {
  const { data, isLoading } = useDevices();
  const { status: sseStatus } = useSSEEvents();

  let content = null;

  if (!isLoading && data) {
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

    content = (
      <>
        <Security cameras={cameras} />
        <Groups
          rooms={data.rooms}
          devices={data.devices}
          loading={isLoading}
        />
      </>
    );
  }

  return (
    <div>
      <Header />
      <ConnectionStatus status={sseStatus} />
      <div>
        <SideBar/>
        <div className='body'>
          {content}
        </div>
      </div>
    </div>
  );
}