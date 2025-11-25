import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import useApiCall from '../../hooks/api';
import { RouteComponentProps } from 'react-router-dom';

import type { DeviceApiResponse } from '../../api/types';

export default function Device({ match: { params: { id }}} : RouteComponentProps<{ id: string }>) {
  const { loading, error, data } = useApiCall<DeviceApiResponse>(`/device/${id}`);

  if (loading || !data) {
    return <></>;
  }

  const { device } = data;

  return (
    <div>
      <Header />
      <div>
        <SideBar hideOnMobile />
        <div className='body body--with-padding'>
          <h2>{device.name}</h2>
          <div className="device__top">
            <div className="device__status">
              {device.capabilities.map(() => {
                
              })}
            </div>
            <div className="device__info">
              <dl>
                <dt>Provider</dt>
                <dd>{device.provider}</dd>
                <dt>Provider Identifer</dt>
                <dd>{device.providerId}</dd>
                <dt>Manufactuer</dt>
                <dd>N/A</dd>
                <dt>Model</dt>
                <dd>N/A</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}