import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import Security from '../security';
import Groups from '../groups';
import useApiCall from '../../hooks/api';

export default function Home() {
  const { data, loading } = useApiCall('/devices');
  let content = <></>;

  if (!loading) {
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
          loading={loading}
        />
      </>
    );
  }

  return (
    <div>
      <Header />
      <div>
        <SideBar/>
        <div className='body'>
          {content}
        </div>
      </div>
    </div>
  );
}