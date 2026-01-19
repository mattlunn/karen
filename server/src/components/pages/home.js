import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import Security from '../security';
import Groups from '../groups';
import useApiCall from '../../hooks/api';

export default function Home() {
  const { data, loading } = useApiCall('/devices');

  // Extract cameras from devices array based on CAMERA capability
  const cameras = (data?.devices ?? [])
    .filter(device => device.capabilities.some(cap => cap.type === 'CAMERA'))
    .map(device => {
      const cameraCapability = device.capabilities.find(cap => cap.type === 'CAMERA');
      return {
        id: device.id,
        name: device.name,
        snapshotUrl: cameraCapability.snapshotUrl
      };
    });

  return (
    <div>
      <Header />
      <div>
        <SideBar/>
        <div className='body'>
          <Security cameras={cameras} />
          <Groups
            rooms={data?.rooms ?? []}
            devices={data?.devices ?? []}
            loading={loading}
          />
        </div>
      </div>
    </div>
  );
}