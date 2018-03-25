import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Security from '../security';
import resources from '../resources';
import { STATUS, SECURITY } from '../../constants/resources';

@resources([ STATUS, SECURITY ])
export default class Home extends Component {
  render() {
    return (
      <div>
        <div>
          <SideBar/>
          <div className='body'>
            <Security />
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}