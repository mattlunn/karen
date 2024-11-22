import React from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import gql from 'graphql-tag';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { useQuery, useMutation } from '@apollo/client';

const GET_HOUSE_STATE = gql`
  query GetHouseStates {
    stays: getUsers {
      id
      avatar
      status
      since
      until
    }

    security: getSecurityStatus {
      alarmMode
    }

    heating: getHeating {
      centralHeatingMode
      dhwHeatingMode
    }
  }
`;

const SET_CENTRAL_HEATING_MODE = gql`
  mutation UpdateCentralHeatingMode($mode: CentralHeatingMode) {
    updateCentralHeatingMode(mode: $mode) {
      centralHeatingMode
    }
  }
`;

const SET_DHW_HEATING_MODE = gql`
  mutation UpdateDHWHeatingMode($mode: DHWHeatingMode) {
    updateDHWHeatingMode(mode: $mode) {
      dhwHeatingMode
    }
  }
`;

const SET_ALARM_MODE = gql`
  mutation UpdateAlarm($mode: AlarmMode) {
    updateAlarm(mode: $mode) {
      alarmMode
    }
  }
`;

function HomeControlButton({ onClick, value, currentValue, label }) {
  return (
    <button disabled={currentValue === value} onClick={() => onClick({
      variables: {
        mode: value
      }
    })}>{label}</button>
  );
}

export default function Sidebar({ hideOnMobile}) {
  const { loading, data } = useQuery(GET_HOUSE_STATE);
  const [updateCentralHeatingMode] = useMutation(SET_CENTRAL_HEATING_MODE);
  const [updateDHWHeatingMode] = useMutation(SET_DHW_HEATING_MODE);
  const [updateAlarmMode] = useMutation(SET_ALARM_MODE);

  let body = null;

  if (loading === false) {
    const stays = data.stays;
    const alarmMode = data.security.alarmMode;
    const { centralHeatingMode, dhwHeatingMode } = data.heating;

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
            <HomeControlButton currentValue={alarmMode} label="Home" onClick={updateAlarmMode} value="OFF" />
            <HomeControlButton currentValue={alarmMode} label="Away" onClick={updateAlarmMode} value="AWAY" />
            <HomeControlButton currentValue={alarmMode} label="Night" onClick={updateAlarmMode} value="NIGHT" />
          </div>
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faFire} /></h3>
          <div>
            <HomeControlButton currentValue={centralHeatingMode} label="On" onClick={updateCentralHeatingMode} value="ON" />
            <HomeControlButton currentValue={centralHeatingMode} label="Setback" onClick={updateCentralHeatingMode} value="SETBACK" />
            <HomeControlButton currentValue={centralHeatingMode} label="Off" onClick={updateCentralHeatingMode} value="OFF" />
          </div>
        </div>

        <div className="sidebar__home-controls">
          <h3 className="home-controls__title"><FontAwesomeIcon icon={faDroplet} /></h3>
          <div>
            <HomeControlButton currentValue={dhwHeatingMode} label="On" onClick={updateDHWHeatingMode} value="ON" />
            <HomeControlButton currentValue={dhwHeatingMode} label="Off" onClick={updateDHWHeatingMode} value="OFF" />
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