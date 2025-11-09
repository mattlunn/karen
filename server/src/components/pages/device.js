import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';

export default function Device({ match: { params: { id }}}) {
  const { loading, error, data } = useApiCall(`/device/${id}`);

  console.log(data);

  return (
    <div>
      <Header />
      <div>
        <SideBar hideOnMobile />
        <div className='body body--with-padding'>
          <h2>{name}</h2>
        </div>
      </div>
    </div>
  );
}