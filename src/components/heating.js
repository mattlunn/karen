import React, { Component } from 'react';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import 'rc-slider/assets/index.css';
import { connect } from 'react-redux';
import {
  getCurrentTemperature,
  getEta,
  getHumidity,
  getIsHeating,
  getIsHome,
  getTargetTemperature
} from '../reducers/heating';

const SliderWithTooltip = createSliderWithTooltip(Slider);

function mapStateToProps(state) {
  return {
    targetTemperature: getTargetTemperature(state.heating),
    currentTemperature: getCurrentTemperature(state.heating),
    eta: getEta(state.heating)
  };
}

@connect(mapStateToProps)
export default class Heating extends Component {
  constructor() {
    super();

    this.state = {
      value: 0
    };
  }

  handleOnChange = (value) => {
    this.setState({
      value
    });
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
    const marks = {
      [this.props.currentTemperature]: {
        label: ' ',
        style: {
          background: 'red',
          marginLeft: '0',
          top: '-24px',
          width: '2px',
          height: '28px',
          zIndex: -10
        }
      },
      10: 'Off',
      25: '25°C'
    };

    return (
      <div className="heating">
        <div className="heating__slider">
          <SliderWithTooltip
            min={10}
            max={25}
            marks={marks}
            step={0.5}
            tipFormatter={this.formatTip}
            value={this.props.currentTemperature}
          />
        </div>
        <div className="heating__eta">
          <strong>ETA:</strong> {this.props.eta}
        </div>
      </div>
    );
  }
}