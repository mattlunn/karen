import React, { Component } from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import Security from '../security';
import Groups from '../groups';

export default class Home extends Component {
  render() {
    return (
      <div>
        <Header />
        <div>
          <SideBar/>
          <div className='body'>
            <Security />
            <Groups />
          </div>
        </div>
      </div>
    );
  }
}