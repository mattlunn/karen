import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import gql from 'graphql-tag';
import { graphql } from '@apollo/client/react/hoc';
import { HOME, AWAY } from '../constants/status';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDroplet, faFire, faShieldHalved } from '@fortawesome/free-solid-svg-icons';

class SideBar extends Component {
  render() {
    const { stays, alarmMode, centralHeatingMode, dhwHeatingMode, setAlarmMode, setCentralHeatingMode } = this.props;
    const isArmed = alarmMode !== 'OFF';

    return (
      <div className={classnames('sidebar', {
        'sidebar--hidden-on-mobile': this.props.hideOnMobile
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

        {stays && stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}

        <div className="sidebar__icon" style={{ marginTop: '50px' }}><FontAwesomeIcon icon={faShieldHalved} /></div>
        <div className="sidebar__alarm-status">
          <button disabled={alarmMode === 'OFF'} onClick={() => setAlarmMode('OFF')}>Home</button>
          <button disabled={alarmMode === 'AWAY'} onClick={() => setAlarmMode('AWAY')}>Away</button>
          <button disabled={alarmMode === 'NIGHT'} onClick={() => setAlarmMode('NIGHT')}>Night</button>
        </div>

        <div className="sidebar__icon"><FontAwesomeIcon icon={faFire} /></div>
        <div className="sidebar__alarm-status">
          <button disabled={centralHeatingMode === 'ON'} onClick={() => setCentralHeatingMode('ON')}>On</button>
          <button disabled={centralHeatingMode === 'SETBACK'} onClick={() => setCentralHeatingMode('SETBACK')}>Setback</button>
          <button disabled={centralHeatingMode === 'OFF'} onClick={() => setCentralHeatingMode('OFF')}>Off</button>
        </div>

        <div className="sidebar__icon"><FontAwesomeIcon icon={faDroplet} /></div>
        <div className="sidebar__alarm-status">
          <button disabled={dhwHeatingMode === 'ON'} onClick={() => setAlarmMode('ON')}>On</button>
          <button disabled={dhwHeatingMode === 'OFF'} onClick={() => setAlarmMode('OFF')}>Off</button>
        </div>
      </div>
    );
  }
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

const withSetAlarmStatus = graphql(gql`
  mutation updateAlarm($mode: AlarmMode) {
    updateAlarm(mode: $mode) {
      alarmMode
    }
  }
`, {
  props: ({ mutate, ownProps }) => ({
    ...ownProps,
    setAlarmMode(mode) {
      mutate({
        variables: { mode }
      });
    }
  }),

  options: {
    update(proxy, { data: { updateAlarm: { alarmMode }}}) {
      proxy.writeQuery({
        query: gql`{
          getSecurityStatus {
            alarmMode
          }
        }`,

        data: {
          getSecurityStatus: {
            alarmMode
          }
        }
      });
    }
  }
});

export default withData(withSetAlarmStatus(SideBar));