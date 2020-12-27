import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import gql from 'graphql-tag';
import { graphql } from '@apollo/react-hoc';

class SideBar extends Component {
  render() {
    const { stays, security } = this.props;
    const isArmed = security && security.alarmMode !== 'OFF';

    return (
      <div className={classnames('sidebar', {
        'sidebar--hidden-on-mobile': this.props.hideOnMobile
      })}>
        <div className="sidebar__house">
          <div className={classnames('sidebar__house-border', {
            'sidebar__house-border--armed': isArmed,
            'sidebar__house-border--off': !isArmed,
          })}>
            <div className={classnames('house', {
              'house--away': security && security.alarmMode === 'AWAY',
              'house--home': security && security.alarmMode !== 'AWAY'
            })} />
          </div>
        </div>

        <h2>Effra Road</h2>

        {stays && stays.map((stay) => <UserStatus key={stay.id} {...stay} />)}
      </div>
    );
  }
}

export default graphql(gql`{
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
  props: ({ data }) => data
})(SideBar);