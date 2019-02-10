import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { AWAY, HOME } from '../constants/status';
import gql from 'graphql-tag';
import { graphql } from 'react-apollo';

@graphql(gql`{
  stays: getUsers {
    handle
    id
    avatar
    status
    since
    until
  }
}`, {
  props: ({ data: { stays }}) => ({
    stays
  })
})
export default class SideBar extends Component {
  render() {
    const { stays } = this.props;

    return (
      <div className="sidebar">
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