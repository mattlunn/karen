import React from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';

const QUERY = gql`
query($id: ID!) {
  getDevice(id: $id) {
    id
    name
    status

    capabilities {
      __typename

      ...on Thermostat {
        targetTemperature
        currentTemperature
      }
    }
  }
}
`;

export default function Device({ match: { params: { id }}}) {
  const { loading, error, data } = useQuery(QUERY, {
    variables: {
      id
    },
  });

  if (loading) return <></>;

  const {
    name
  } = data.getDevice;

  return (
    <div>
      <Header />
      <div>
        <SideBar hideOnMobile />
        <div className='body body--with-padding'>
          <h2>{name}</h2>
        </div>
      </div>

      <Modals />
    </div>
  );
}