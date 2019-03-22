import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import Security from '../security';
import Heating from '../heating';
import Lighting from '../lighting';
import resources from '../resources';
import { HEATING, LIGHTING } from '../../constants/resources';

@resources([ HEATING, LIGHTING ])
export default class Home extends Component {
  render() {
    return (
      <div>
        <Header />
        <div>
          <SideBar/>
          <div className='body'>
            <Security />
            <Heating />
            <Lighting />
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}