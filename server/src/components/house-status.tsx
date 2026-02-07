import React from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved, faTemperatureArrowUp } from '@fortawesome/free-solid-svg-icons';
import { SegmentedControl, Text, Title } from '@mantine/core';
import { useUsers } from '../hooks/queries/use-users';
import { useHeating } from '../hooks/queries/use-heating';
import { useSecurity } from '../hooks/queries/use-security';
import { useAlarmMutation } from '../hooks/mutations/use-security-mutations';
import { useHeatingMutation } from '../hooks/mutations/use-heating-mutations';
import { humanDate } from '../helpers/date';
import dayjs from '../dayjs';
import type { AlarmMode, CentralHeatingMode, DHWHeatingMode } from '../api/types';
import styles from './house-status.module.css';

export default function HouseStatus() {
  const { isLoading: usersLoading, data: usersData } = useUsers();
  const { isLoading: heatingLoading, data: heatingData } = useHeating();
  const { isLoading: securityLoading, data: securityData } = useSecurity();

  const { mutate: updateHeating, isPending: heatingMutating } = useHeatingMutation();
  const { mutate: updateAlarmMode, isPending: alarmMutating } = useAlarmMutation();

  const loading = usersLoading || heatingLoading || securityLoading;

  if (loading || !usersData || !heatingData || !securityData) {
    return <div className={styles.root}></div>;
  }

  const stays = usersData;
  const alarmMode = securityData.alarmMode;
  const { centralHeating: commonThermostatMode, dhw: dhwHeatingMode } = heatingData;
  const preWarmStartTime = heatingData.preWarmStartTime ? dayjs(heatingData.preWarmStartTime) : null;

  return (
    <div className={styles.root}>
      <div className={styles.house}>
        <div className={classnames(styles.houseBorder, {
          [styles.houseBorderAway]: stays.every(x => x.status === AWAY),
          [styles.houseBorderHome]: stays.some(x => x.status === HOME),
        })}>
          <div className={classnames(styles.houseIcon, {
            [styles.houseIconAway]: stays.every(x => x.status === AWAY),
            [styles.houseIconHome]: stays.some(x => x.status === HOME)
          })} />
        </div>
      </div>

      <div className={styles.stays}>
        {stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}
      </div>

      <div className={styles.homeControls}>
        <Title order={3} className={styles.homeControlsTitle}><FontAwesomeIcon icon={faShieldHalved} /></Title>
        <SegmentedControl
          value={alarmMode}
          onChange={(value) => updateAlarmMode({ alarmMode: value as AlarmMode })}
          disabled={alarmMutating}
          data={[
            { label: 'Home', value: 'OFF' },
            { label: 'Away', value: 'AWAY' },
            { label: 'Night', value: 'NIGHT' },
          ]}
        />
      </div>

      <div className={styles.homeControls}>
        <Title order={3} className={styles.homeControlsTitle}><FontAwesomeIcon icon={faFire} /></Title>
        <SegmentedControl
          value={commonThermostatMode ?? ''}
          onChange={(value) => updateHeating({ centralHeating: value as CentralHeatingMode })}
          disabled={heatingMutating}
          data={[
            { label: 'On', value: 'ON' },
            { label: 'Setback', value: 'SETBACK' },
            { label: 'Off', value: 'OFF' },
          ]}
        />
      </div>

      <div className={styles.homeControls}>
        <Title order={3} className={styles.homeControlsTitle}><FontAwesomeIcon icon={faDroplet} /></Title>
        <SegmentedControl
          value={dhwHeatingMode}
          onChange={(value) => updateHeating({ dhw: value as DHWHeatingMode })}
          disabled={heatingMutating}
          data={[
            { label: 'On', value: 'ON' },
            { label: 'Off', value: 'OFF' },
          ]}
        />
      </div>

      {preWarmStartTime && (
        <div className={styles.preWarmTime}>
          <Text><FontAwesomeIcon icon={faTemperatureArrowUp} /></Text>
          <Text>
            Pre-heating will start at {`${preWarmStartTime.format('HH:mm')} ${humanDate(preWarmStartTime)}`}
          </Text>
        </div>
      )}
    </div>
  );
}
