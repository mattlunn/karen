import React, { Component } from 'react';
import classnames from 'classnames';
import { connect } from 'react-redux';
import { getLights } from '../reducers/lighting';
import { setLightSwitchStatus } from '../actions/lighting';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons';

function mapStateToProps(state) {
  return {
    lights: getLights(state)
  };
}

@connect(mapStateToProps, {
  setLightSwitchStatus
})
export default class Lighting extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <ul>
        {this.props.lights.map((light, idx) => {
          return (
            <li key={idx} className={classnames('lighting', { 'lighting--is-on': light.switchIsOn })}>
              <div className={classnames('lighting__container', { 'lighting__container--is-on': light.switchIsOn })} onClick={() => this.props.setLightSwitchStatus(light.switchFeatureId, !light.switchIsOn)}>
                <span className="lighting__name">{light.name}</span>
                <span className="lighting__light">
                  <FontAwesomeIcon icon={faLightbulb} />
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }
}