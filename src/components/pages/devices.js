import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import { graphql } from '@apollo/react-hoc';
import gql from 'graphql-tag';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faThermometerQuarter } from '@fortawesome/free-solid-svg-icons/faThermometerQuarter';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faVolumeUp } from '@fortawesome/free-solid-svg-icons/faVolumeUp';
import { Link } from 'react-router-dom';

class Device extends Component {
  _renderDeviceIcon(type) {
    switch (type) {
      case 'camera':
        return faVideo;
      case 'motion_sensor':
      case 'multi_sensor':
          return faEye;
      case 'alexa':
        return faVolumeUp;
      case 'light':
        return faLightbulb;
      case 'thermostat':
        return faThermometerQuarter;
      default: 
        return faQuestion;
    }
  }

  _renderDevice({ type, device: { id, name, status }}) {
    return (
      <Link to={`/device/${id}`}>
        <span className="device-icon"><FontAwesomeIcon icon={this._renderDeviceIcon(type)} /></span>
        {name}
      </Link>
    );
  }

  render() {
    const { active, old } = (this.props.devices || [])
      .sort((a, b) => a.device.name.localeCompare(b.device.name))
      .reduce((acc, device) => {
        acc[device.device.status === 'OK' ? 'active' : 'old'].push(device);

        return acc;
      }, { active: [], old: [] });

    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body body--with-padding'>
            <h2>Devices</h2>

            <ul className="device-list">
              {active.map((device) => (
                <li key={device.device.id}>
                  {this._renderDevice(device)}
                </li>
              ))}
            </ul>

            {old.length > 0 ? (
              <>
              <h3>Offline Devices</h3>

              <ul className="device-list">
                {active.map((device) => (
                  <li key={device.device.id}>
                    {this._renderDevice(device)}
                  </li>
                ))}
              </ul>
              </>
            ) : null}
            
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}


export default graphql(gql`
  query GetDevices {
    devices: getDevices {
      type
      device {
        id
        name
        status
      }
    }
  }
`, {
  props: ({ data: { devices }}) => ({ devices }),
})(Device);