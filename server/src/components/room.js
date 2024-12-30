import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function Room({ name, icon, children }) {
  return (
    <>
      <h3 className="room__title"><FontAwesomeIcon icon={icon} className="room__title-icon" /> {name}</h3>
      <div>
        <ul className="room__device-controls">
          {children.map(child => <li className="room__device-control">{child}</li>)}
        </ul>
      </div>
    </>
  );
}