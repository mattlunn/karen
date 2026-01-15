import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import Security from '../security';
import Groups from '../groups';
import useApiCall from '../../hooks/api';

export default function Home() {
  const { data, loading } = useApiCall('/home');

  return (
    <div>
      <Header />
      <div>
        <SideBar/>
        <div className='body'>
          <Security cameras={data?.cameras ?? []} />
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