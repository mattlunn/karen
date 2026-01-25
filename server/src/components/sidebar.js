import React from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { useUsers } from '../hooks/queries/use-users';
import { useHeating } from '../hooks/queries/use-heating';
import { useSecurity } from '../hooks/queries/use-security';
import { useAlarmMutation } from '../hooks/mutations/use-security-mutations';
import { useHeatingMutation } from '../hooks/mutations/use-heating-mutations';

function HomeControlButton({ onClick, value, currentValue, label, loading }) {
  return (
    <button disabled={loading || currentValue === value} onClick={() => onClick(value)}>{label}</button>
  );
}

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
          <div>
            <HomeControlButton currentValue={alarmMode} label="Home" onClick={(alarmMode) => updateAlarmMode({ alarmMode })} value="OFF" loading={alarmMutating} />
            <HomeControlButton currentValue={alarmMode} label="Away" onClick={(alarmMode) => updateAlarmMode({ alarmMode })} value="AWAY" loading={alarmMutating} />
            <HomeControlButton currentValue={alarmMode} label="Night" onClick={(alarmMode) => updateAlarmMode({ alarmMode })} value="NIGHT" loading={alarmMutating} />
          </div>
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faFire} /></h3>
          <div>
            <HomeControlButton currentValue={commonThermostatMode} label="On" onClick={(mode) => updateHeating({ centralHeating: mode })} value="ON" loading={heatingMutating} />
            <HomeControlButton currentValue={commonThermostatMode} label="Setback" onClick={(mode) => updateHeating({ centralHeating: mode })} value="SETBACK" loading={heatingMutating} />
            <HomeControlButton currentValue={commonThermostatMode} label="Off" onClick={(mode) => updateHeating({ centralHeating: mode })} value="OFF" loading={heatingMutating} />
          </div>
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faDroplet} /></h3>
          <div>
            <HomeControlButton currentValue={dhwHeatingMode} label="On" onClick={(mode) => updateHeating({ dhw: mode })} value="ON" loading={heatingMutating} />
            <HomeControlButton currentValue={dhwHeatingMode} label="Off" onClick={(mode) => updateHeating({ dhw: mode })} value="OFF" loading={heatingMutating} />
          </div>
        </div>
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