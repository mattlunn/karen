import React, { Component } from 'react';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import 'rc-slider/assets/index.css';

const SliderWithTooltip = createSliderWithTooltip(Slider);

export default class Heating extends Component {
  marks = {
    10: 'Off',
    18: {
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
    25: '25°C'
  };

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
    return (
      <div className="heating">
        <div className="heating__slider">
          <SliderWithTooltip min={10} max={25} marks={this.marks} step={0.5} tipFormatter={this.formatTip} />
        </div>
        <div className="heating__eta">
          <strong>ETA:</strong> 24/02/1991 10:45:10
        </div>
      </div>
    );
  }
}