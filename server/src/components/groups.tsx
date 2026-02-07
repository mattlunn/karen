import React from 'react';
import classnames from 'classnames';
import Group from './group';
import type { HomeRoom, RestDeviceResponse } from '../api/types';
import styles from './groups.module.css';

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
    <ul className={styles.list}>
      {rooms.map((room) => (
        <li className={styles.group} key={room.id}>
          <Group
            name={room.name}
            displayIconName={room.displayIconName}
            devices={devices.filter(x => x.roomId === room.id)}
          />
        </li>
      ))}

      <li className={classnames(styles.group, styles.groupFullWidth)}>
        <Group name="Others" displayIconName={null} devices={devices.filter(x => x.roomId === null)} />
      </li>
    </ul>
  );
}
