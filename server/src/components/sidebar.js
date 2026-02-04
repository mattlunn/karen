import React from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved, faTemperatureArrowUp } from '@fortawesome/free-solid-svg-icons';
import { SegmentedControl } from '@mantine/core';
import { useUsers } from '../hooks/queries/use-users';
import { useHeating } from '../hooks/queries/use-heating';
import { useSecurity } from '../hooks/queries/use-security';
import { useAlarmMutation } from '../hooks/mutations/use-security-mutations';
import { useHeatingMutation } from '../hooks/mutations/use-heating-mutations';
import dayjs from '../dayjs';

export default function Sidebar({ hideOnMobile}) {
  const { isLoading: usersLoading, data: usersData } = useUsers();
  const { isLoading: heatingLoading, data: heatingData } = useHeating();
  const { isLoading: securityLoading, data: securityData } = useSecurity();

  const { mutate: updateHeating, isPending: heatingMutating } = useHeatingMutation();
  const { mutate: updateAlarmMode, isPending: alarmMutating } = useAlarmMutation();

  const loading = usersLoading || heatingLoading || securityLoading;

  let body = null;

  if (!loading && usersData && heatingData && securityData) {
    const stays = usersData;
    const alarmMode = securityData.alarmMode;
    const { centralHeating: commonThermostatMode, dhw: dhwHeatingMode } = heatingData;

    body = (
      <>
        <div className="sidebar__house">
          <div className={classnames('sidebar__house-border', {
            'sidebar__house-border--away': stays.every(x => x.status === AWAY),
            'sidebar__house-border--home': stays.some(x => x.status === HOME),
          })}>
            <div className={classnames('house', {
              'house--away': stays.every(x => x.status === AWAY),
              'house--home': stays.some(x => x.status === HOME)
            })} />
          </div>
        </div>

        <div className="sidebar__stays">
          {stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faShieldHalved} /></h3>
          <SegmentedControl
            value={alarmMode}
            onChange={(alarmMode) => updateAlarmMode({ alarmMode })}
            disabled={alarmMutating}
            data={[
              { label: 'Home', value: 'OFF' },
              { label: 'Away', value: 'AWAY' },
              { label: 'Night', value: 'NIGHT' },
            ]}
          />
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faFire} /></h3>
          <SegmentedControl
            value={commonThermostatMode}
            onChange={(mode) => updateHeating({ centralHeating: mode })}
            disabled={heatingMutating}
            data={[
              { label: 'On', value: 'ON' },
              { label: 'Setback', value: 'SETBACK' },
              { label: 'Off', value: 'OFF' },
            ]}
          />
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faDroplet} /></h3>
          <SegmentedControl
            value={dhwHeatingMode}
            onChange={(mode) => updateHeating({ dhw: mode })}
            disabled={heatingMutating}
            data={[
              { label: 'On', value: 'ON' },
              { label: 'Off', value: 'OFF' },
            ]}
          />
        </div>

        {heatingData.preWarm && (
          <div className="sidebar__prewarm-info">
            <h3 className="home-controls__title"><FontAwesomeIcon icon={faTemperatureArrowUp} /></h3>
            <div className="prewarm-info__details">
              <span>Pre-heating starts {dayjs(heatingData.preWarm.startTime).format('HH:mm')}</span>
              <span className="prewarm-info__eta">ETA: {dayjs(heatingData.preWarm.targetEta).format('HH:mm')}</span>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={classnames('sidebar', {
      'sidebar--hidden-on-mobile': hideOnMobile
    })}>
      {body}
    </div>
  );
}