import React from 'react';
import SideBar from '../sidebar';
import Header from '../header';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faQuestion } from '@fortawesome/free-solid-svg-icons/faQuestion';
import { faThermometerQuarter } from '@fortawesome/free-solid-svg-icons/faThermometerQuarter';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { Link } from 'react-router-dom';
import useApiCall from '../../hooks/api';

function getDeviceIcon(capabilities) {
  if (capabilities.some(x => x.type === 'CAMERA')) {
    return faVideo;
  }

  if (capabilities.some(x => x.type === 'THERMOSTAT')) {
    return faThermometerQuarter;
  }

  if (capabilities.some(x => x.type === 'LIGHT')) {
    return faLightbulb;
  }

  if (capabilities.some(x => x.type === 'MOTION_SENSOR')) {
    return faEye;
  }

  return faQuestion;
}

function DeviceLink({ id, name, capabilities }) {
  return (
    <Link to={`/device/${id}`}>
      <span className="device-icon"><FontAwesomeIcon icon={getDeviceIcon(capabilities)} /></span>
      {name}
    </Link>
  );
}

export default function Devices() {
  const { data, loading } = useApiCall('/devices');

  if (loading || !data) {
    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body body--with-padding'>
            <h2>Devices</h2>
          </div>
        </div>
      </div>
    );
  }

  const { active, old } = (data.devices || [])
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
                <DeviceLink {...device} />
              </li>
            ))}
          </ul>

          {old.length > 0 ? (
            <>
            <h3>Offline Devices</h3>

            <ul className="device-list">
              {old.map((device) => (
                <li key={device.id}>
                  <DeviceLink {...device} />
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
