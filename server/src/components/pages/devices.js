import React, { Component } from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import { graphql } from '@apollo/client/react/hoc';
import gql from 'graphql-tag';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faThermometerQuarter } from '@fortawesome/free-solid-svg-icons/faThermometerQuarter';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { Link } from 'react-router-dom';

class Device extends Component {
  _renderDeviceIcon(capabilities) {
    if (capabilities.some(x => x.__typename === 'Camera')) {
      return faVideo;
    }

    if (capabilities.some(x => x.__typename === 'Thermostat')) {
      return faThermometerQuarter;
    }

    if (capabilities.some(x => x.__typename === 'Light')) {
      return faLightbulb;
    }

    if (capabilities.some(x => x.__typename === 'MotionSensor')) {
      return faEye;
    }
    
    return faQuestion;
  }

  _renderDevice({ id, name, status, capabilities }) {
    return (
      <Link to={`/device/${id}`}>
        <span className="device-icon"><FontAwesomeIcon icon={this._renderDeviceIcon(capabilities)} /></span>
        {name}
      </Link>
    );
  }

  render() {
    const { active, old } = (this.props.devices || [])
      .toSorted((a, b) => a.name.localeCompare(b.name))
      .reduce((acc, device) => {
        acc[device.status === 'OK' ? 'active' : 'old'].push(device);

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
                <li key={device.id}>
                  {this._renderDevice(device)}
                </li>
              ))}
            </ul>

            {old.length > 0 ? (
              <>
              <h3>Offline Devices</h3>

              <ul className="device-list">
                {active.map((device) => (
                  <li key={device.id}>
                    {this._renderDevice(device)}
                  </li>
                ))}
              </ul>
              </>
            ) : null}
            
          </div>
        </div>
      </div>
    );
  }
}


export default graphql(gql`
  query GetDevices {
    devices: getDevices {
      id
      name
      status

      capabilities {
        __typename
      }
    } 
  }
`, {
  props: ({ data: { devices }}) => ({ devices }),
})(Device);