import React, { useEffect } from 'react';
import Group from './group';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';

const DEVICE_FRAGMENT = gql`
  fragment DeviceFragment on Device {
    id
    name 

    room {
      id
    }

    ...on Thermostat {
      id
      name

      isHeating
      power
      status
      targetTemperature
      currentTemperature
    }

    ...on Light {
      id
      name

      brightness
      isOn
    }
  }
`;

export default function Groups() {
  const { data, loading, subscribeToMore } = useQuery(
    gql`
      query GetHomeData {
        getRooms {
          id
          name

          displayIconName
          displayWeight
        }
        
        getDevices {
          ...DeviceFragment
        }
      }

      ${DEVICE_FRAGMENT}
    `
  );

  useEffect(() => {
    return subscribeToMore({
      document: gql`
        subscription GetDeviceUpdates {
          onDeviceChanged {
            ...DeviceFragment  
          } 
        }

        ${DEVICE_FRAGMENT}
      `,
      updateQuery(prev, { subscriptionData: { data: { onDeviceChanged }}} ) {
        return {
          getRooms: prev.getRooms,
          getDevices: prev.getDevices.map(d => {
            return d.id === onDeviceChanged.id ? { ...d, ...onDeviceChanged } : d;
          })
        };
      }
    });
  });

  if (loading) {
    return <></>;
  }
  
  return (
    <ul className="group-list">
      {data.getRooms.map((room) => <li className="group" key={room.id}><Group name={room.name} displayIconName={room.displayIconName} devices={data.getDevices.filter(x => x.room?.id === room.id)} /></li>)}
      
      <li className="group group--full-width"><Group name="Others" devices={data.getDevices.filter(x => x.room === null)} /></li>
    </ul>
  );
}