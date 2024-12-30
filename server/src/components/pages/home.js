import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import Security from '../security';
import Heating from '../heating';
import Lighting from '../lighting';
import Rooms from '../rooms';

export default class Home extends Component {
  render() {
    return (
      <div>
        <Header />
        <div>
          <SideBar/>
          <div className='body'>
            <Security />
            <Rooms />
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}