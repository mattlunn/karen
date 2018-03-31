import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Security from '../security';
import Heating from '../heating';
import resources from '../resources';
import { STATUS, SECURITY, HEATING } from '../../constants/resources';

@resources([ STATUS, SECURITY, HEATING ])
export default class Home extends Component {
  render() {
    return (
      <div>
        <div>
          <SideBar/>
          <div className='body'>
            <Security />
            <Heating />
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}