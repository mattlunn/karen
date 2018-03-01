import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import resources from '../resources';
import { STATUS } from '../../constants/resources';

@resources([ STATUS ])
export default class Home extends Component {
  render() {
    return (
      <div>
        <div>
          <SideBar/>
          <div className='body'>
            <h1>Hello</h1>
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}