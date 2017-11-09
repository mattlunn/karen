import React, { Component } from 'react';
import TopBar from '../topbar';
import SideBar from '../sidebar';
import resources from '../resources';
import { STATUS } from '../../constants/resources';

@resources([ STATUS ])
export default class Home extends Component {
  render() {
    return (
      <div>
        <TopBar/>
        <div>
          <SideBar/>
          <div className='body'>
            <h1>Hello</h1>
          </div>
        </div>
      </div>
    );
  }
}