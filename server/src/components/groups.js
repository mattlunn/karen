import React from 'react';
import Group from './group';
import { useQuery } from '@apollo/client';
import gql from 'graphql-tag';

export default function Groups() {
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
    <ul className="group-list">
      {data.getRooms.map((room) => <li className="group"><Group name={room.name} displayIconName={room.displayIconName} devices={data.getDevices.filter(x => x.room?.id === room.id)} /></li>)}
      
      <li className="group group--full-width"><Group name="Others" devices={data.getDevices.filter(x => x.room === null)} /></li>
    </ul>
  );
}