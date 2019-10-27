import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { AWAY, HOME } from '../constants/status';
import gql from 'graphql-tag';
import { graphql } from '@apollo/react-hoc';

@graphql(gql`{
  stays: getUsers {
    id
    avatar
    status
    since
    until
  }
}`, {
  props: ({ data }) => data
})
export default class SideBar extends Component {
  render() {
    const { stays } = this.props;

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

        <h2>Effra Road</h2>

        {stays && stays.map((stay) => <UserStatus {...stay} />)}
      </div>
    );
  }
}