import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import resources from '../resources';
import { STATUS } from '../../constants/resources';

@resources([ STATUS, TIMELINE ])
export default class Timeline extends Component {
  render() {
    return (
      <div>
        <Header />
        <div>
          <SideBar/>
          <div className='body'>

          </div>
        </div>

        <Modals />
      </div>
    );
  }
}