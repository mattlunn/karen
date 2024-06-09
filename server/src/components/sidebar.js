import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import gql from 'graphql-tag';
import { graphql } from '@apollo/react-hoc';
import { HOME, AWAY } from '../constants/status';

class SideBar extends Component {
  render() {
    const { stays, alarmMode, setAlarmMode } = this.props;
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

        <div className="sidebar__alarm-status">
          <button disabled={alarmMode === 'OFF'} onClick={() => setAlarmMode('OFF')}>Home</button>
          <button disabled={alarmMode === 'AWAY'} onClick={() => setAlarmMode('AWAY')}>Away</button>
          <button disabled={alarmMode === 'NIGHT'} onClick={() => setAlarmMode('NIGHT')}>Night</button>
        </div>

        {stays && stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}
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
}`, {
  props({ data }) {
    return {
      stays: data.stays,
      alarmMode: data.security?.alarmMode
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