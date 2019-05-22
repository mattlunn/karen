import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';

export default class History extends Component {
  render() {
    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body'>
            Hello
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}