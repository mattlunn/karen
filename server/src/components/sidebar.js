import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import gql from 'graphql-tag';
import { graphql } from '@apollo/client/react/hoc';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved } from '@fortawesome/free-solid-svg-icons';
import { useMutation } from '@apollo/client';

const SET_CENTRAL_HEATING_MODE = gql`
  mutation updateCentralHeatingMode($mode: CentralHeatingMode) {
    updateCentralHeatingMode(mode: $mode) {
      centralHeatingMode
    }
  }
`;

const SET_DHW_HEATING_MODE = gql`
  mutation updateDHWHeatingMode($mode: DHWHeatingMode) {
    updateDHWHeatingMode(mode: $mode) {
      dhwHeatingMode
    }
  }
`;

const SET_ALARM_MODE = gql`
  mutation updateAlarm($mode: AlarmMode) {
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

function SideBar({ stays, alarmMode, centralHeatingMode, dhwHeatingMode, hideOnMobile}) {
  const [updateCentralHeatingMode] = useMutation(SET_CENTRAL_HEATING_MODE);
  const [updateDHWHeatingMode] = useMutation(SET_DHW_HEATING_MODE);
  const [updateAlarmMode] = useMutation(SET_ALARM_MODE);

  return (
    <div className={classnames('sidebar', {
      'sidebar--hidden-on-mobile': hideOnMobile
    })}>
      <div className="sidebar__house">
        <div className={classnames('sidebar__house-border', {
          'sidebar__house-border--away': stays && stays.every(x => x.status === AWAY),
          'sidebar__house-border--home': stays && stays.some(x => x.status === HOME),
        })}>
          <div className={classnames('house', {
            'house--away': stays && stays.every(x => x.status === AWAY),
            'house--home': stays && stays.some(x => x.status === HOME)
          })} />
        </div>
      </div>

      <div className="sidebar__stays">
        {stays && stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}
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
    </div>
  );
}

const withData = graphql(gql`{
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
}`, {
  props({ data }) {
    return {
      stays: data.stays,
      alarmMode: data.security?.alarmMode,
      ...data.heating
    };
  }
});

export default withData(SideBar);