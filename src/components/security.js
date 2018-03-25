import classNames from 'classnames';
import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getCameras, getIsInHomeMode } from '../reducers/security';

function mapStateToProps(state) {
  return {
    cameras: getCameras(state.security),
    isInHomeMode: getIsInHomeMode(state.security)
  };
}

@connect(mapStateToProps)
export default class Security extends Component {
  render() {
    return (
      <div className="security">
        <ul className="security__camera-list">
          {this.props.cameras.map((camera) => {
            return (
              <li className="security__camera">
                <h3>
                  {camera.name}

                  &nbsp;

                  <span className={classNames('security__home-mode-indicator', {
                    'security__home-mode-indicator--is-home': this.props.isInHomeMode
                  })}>
                    &#x25cf;
                  </span>
                </h3>
                <img src={camera.snapshot} />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}