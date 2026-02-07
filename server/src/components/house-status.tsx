import React from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved, faTemperatureArrowUp } from '@fortawesome/free-solid-svg-icons';
import { SegmentedControl, Text } from '@mantine/core';
import { useUsers } from '../hooks/queries/use-users';
import { useHeating } from '../hooks/queries/use-heating';
import { useSecurity } from '../hooks/queries/use-security';
import { useAlarmMutation } from '../hooks/mutations/use-security-mutations';
import { useHeatingMutation } from '../hooks/mutations/use-heating-mutations';
import { humanDate } from '../helpers/date';
import dayjs from '../dayjs';
import type { AlarmMode, CentralHeatingMode, DHWHeatingMode } from '../api/types';

export default function HouseStatus() {
  const { isLoading: usersLoading, data: usersData } = useUsers();
  const { isLoading: heatingLoading, data: heatingData } = useHeating();
  const { isLoading: securityLoading, data: securityData } = useSecurity();

  const { mutate: updateHeating, isPending: heatingMutating } = useHeatingMutation();
  const { mutate: updateAlarmMode, isPending: alarmMutating } = useAlarmMutation();

  const loading = usersLoading || heatingLoading || securityLoading;

  if (loading || !usersData || !heatingData || !securityData) {
    return null;
  }

  const stays = usersData;
  const alarmMode = securityData.alarmMode;
  const { centralHeating: commonThermostatMode, dhw: dhwHeatingMode } = heatingData;
  const preWarmStartTime = heatingData.preWarmStartTime ? dayjs(heatingData.preWarmStartTime) : null;

  return (
    <div className="house-status">
      <div className="house-status__house">
        <div className={classnames('house-status__house-border', {
          'house-status__house-border--away': stays.every(x => x.status === AWAY),
          'house-status__house-border--home': stays.some(x => x.status === HOME),
        })}>
          <div className={classnames('house', {
            'house--away': stays.every(x => x.status === AWAY),
            'house--home': stays.some(x => x.status === HOME)
          })} />
        </div>
      </div>

      <div className="house-status__stays">
        {stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}
      </div>

      <div className="house-status__home-controls">
        <h3 className="home-controls__title"><FontAwesomeIcon icon={faShieldHalved} /></h3>
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

      <div className="house-status__home-controls">
        <h3 className="home-controls__title"><FontAwesomeIcon icon={faFire} /></h3>
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

      <div className="house-status__home-controls">
        <h3 className="home-controls__title"><FontAwesomeIcon icon={faDroplet} /></h3>
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
        <div className="house-status__pre-warm-time">
          <Text><FontAwesomeIcon icon={faTemperatureArrowUp} /></Text>
          <Text>
            Pre-heating will start at {`${preWarmStartTime.format('HH:mm')} ${humanDate(preWarmStartTime)}`}
          </Text>
        </div>
      )}
    </div>
  );
}
