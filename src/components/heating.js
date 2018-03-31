import React, { Component } from 'react';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import classnames from 'classnames';
import HeatingHeatMap from './heating-heat-map';
import { connect } from 'react-redux';
import { setTargetTemperature } from '../actions/heating';
import {
  getCurrentTemperature,
  getEta,
  getHumidity,
  getIsHeating,
  getIsHome,
  getTargetTemperature,
  getHistory
} from '../reducers/heating';

import 'rc-slider/assets/index.css';

const SliderWithTooltip = createSliderWithTooltip(Slider);
const formatTemperature = (temp) => temp.toFixed(1);

function mapStateToProps(state) {
  return {
    targetTemperature: getTargetTemperature(state.heating),
    currentTemperature: getCurrentTemperature(state.heating),
    eta: getEta(state.heating),
    humidity: getHumidity(state.heating),
    isHeating: getIsHeating(state.heating),
    isHome: getIsHome(state.heating),
    history: getHistory(state.heating)
  };
}

@connect(mapStateToProps, {
  setTargetTemperature
})
export default class Heating extends Component {
  constructor(props) {
    super(props);

    this.state = {
      targetTemperature: props.targetTemperature
    };
  }

  onSliderChange = (value) => {
    this.setState({
      targetTemperature: value === 10 ? null : value
    });
  };

  onAfterSliderChange = (value) => {
    this.props.setTargetTemperature(value === 10 ? null : value);
  };

  formatTip = (value) => {
    switch (value) {
      case 10:
        return 'Off';
      default:
        return `${value}°C`;
    }
  };

  render() {
    const hoursHeatingActive = +((this.props.history.reduce((total, curr) => {
      return total + (curr.end - curr.start)
    }, 0) / 1000 / 60 / 60).toFixed(1));

    const marks = {
      [this.props.currentTemperature]: {
        label: ' ',
        style: {
          background: 'red',
          marginLeft: '0',
          top: '-24px',
          width: '2px',
          height: '28px',
        }
      },
      10: 'Off',
      25: '25°C'
    };

    return (
      <div className={classnames('heating', {
        'heating--is-heating': this.props.isHeating
      })}>
        <div className="heating__side">
          <div className="heating__slider">
            <SliderWithTooltip
              min={10}
              max={25}
              marks={marks}
              step={0.5}
              tipFormatter={this.formatTip}
              defaultValue={this.props.targetTemperature}
              onChange={this.onSliderChange}
              onAfterChange={this.onAfterSliderChange}
            />
          </div>
          <div className="heating__details">
            <dl>
              <dt>Current</dt>
              <dd>{formatTemperature(this.props.currentTemperature)}°C</dd>
            </dl>
            <dl>
              <dt>Target</dt>
              <dd>{this.state.targetTemperature ? `${formatTemperature(this.state.targetTemperature)}°C` : 'Off'}</dd>
            </dl>
            <dl>
              <dt>Humidity</dt>
              <dd>{this.props.humidity}%</dd>
            </dl>
          </div>
        </div>
        <div className="heating__side">
          <HeatingHeatMap activity={this.props.history} />
          <div className="heating__details">
            <dl>
              <dt>Today</dt>
              <dd>
                {hoursHeatingActive}hrs
              </dd>
            </dl>
            <dl>
              <dt>ETA</dt>
              <dd>{this.props.eta || 'N/A'}</dd>
            </dl>
            <dl>
              <dt>State</dt>
              <dd>{this.props.isHome ? 'Home' : 'Away'}</dd>
            </dl>
          </div>
        </div>
      </div>
    );
  }
}