import React, { Component } from 'react';
import UserStatus from './user-status';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { getStays } from '../reducers/stay';
import { AWAY } from '../constants/status';

function mapStateToProps(state) {
  return {
    stays: getStays(state.stay)
  };
}

@connect(mapStateToProps)
export default class SideBar extends Component {
  render() {
    return (
      <div className="sidebar">
        <div className="sidebar__house">
          <div className={classnames('sidebar__house-border', {
            'sidebar__house-border--away': this.props.stays.every(x => x.status === AWAY)
          })}>
            <div className={classnames('house', {
              'house--away': this.props.stays.every(x => x.status === AWAY)
            })} />
          </div>
        </div>

        <h2>Effra Road</h2>

        {this.props.stays.map((stay) => <UserStatus {...stay} />)}
      </div>
    );
  }
}