import React from 'react';
import Room from './room';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';

export default function Rooms() {
  const { data, loading } = useQuery(
    gql`{
      getRooms {
        id
        name

        displayIconName
        displayWeight
      }
      
      getDevices {
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
    }`
  );

  if (loading) {
    return <></>;
  }
  
  return (
    <ul className="room-list">
      {data.getRooms.map((room) => <li className="room"><Room room={room} devices={data.getDevices.filter(x => x.room?.id === room.id)} /></li>)}
    </ul>
  );
}