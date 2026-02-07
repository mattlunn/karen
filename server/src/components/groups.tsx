import React from 'react';
import Group from './group';
import type { HomeRoom, RestDeviceResponse } from '../api/types';

interface GroupsProps {
  rooms?: HomeRoom[];
  devices?: RestDeviceResponse[];
  loading?: boolean;
}

export default function Groups({ rooms = [], devices = [], loading = false }: GroupsProps) {
  if (loading) {
    return <></>;
  }

  return (
    <ul className="group-list">
      {rooms.map((room) => (
        <li className="group" key={room.id}>
          <Group
            name={room.name}
            displayIconName={room.displayIconName}
            devices={devices.filter(x => x.roomId === room.id)}
          />
        </li>
      ))}

      <li className="group group--full-width">
        <Group name="Others" displayIconName={null} devices={devices.filter(x => x.roomId === null)} />
      </li>
    </ul>
  );
}
