import React from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import useApiCall from '../hooks/api';
import useApiMutation from '../hooks/api-mutation';

function HomeControlButton({ onClick, value, currentValue, label, loading }) {
  return (
    <button disabled={loading || currentValue === value} onClick={() => onClick(value)}>{label}</button>
  );
}

export default function Sidebar({ hideOnMobile}) {
  const { loading: usersLoading, data: usersData } = useApiCall('/users');
  const { loading: heatingLoading, data: heatingData } = useApiCall('/heating');
  const { loading: securityLoading, data: securityData } = useApiCall('/security/alarm');

  const { mutate: updateHeating, loading: heatingMutating } = useApiMutation('/heating');
  const { mutate: updateAlarmMode, loading: alarmMutating } = useApiMutation('/security/alarm');

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
            <HomeControlButton currentValue={alarmMode} label="Home" onClick={(mode) => updateAlarmMode({ mode })} value="OFF" loading={alarmMutating} />
            <HomeControlButton currentValue={alarmMode} label="Away" onClick={(mode) => updateAlarmMode({ mode })} value="AWAY" loading={alarmMutating} />
            <HomeControlButton currentValue={alarmMode} label="Night" onClick={(mode) => updateAlarmMode({ mode })} value="NIGHT" loading={alarmMutating} />
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