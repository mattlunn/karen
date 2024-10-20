import React, { Component } from 'react';
import Slider, { createSliderWithTooltip } from 'rc-slider';
import classnames from 'classnames';
import ThermostatHeatMap from './thermostat-heat-map';
import { graphql } from '@apollo/client/react/hoc';
import gql from 'graphql-tag';
import moment from 'moment';
import 'rc-slider/assets/index.css';

const SliderWithTooltip = createSliderWithTooltip(Slider);
const formatTemperature = (temp) => temp.toFixed(1);

class Thermostat extends Component {
  constructor(props) {
    super(props);

    this.state = {};
  }

  static getDerivedStateFromProps(props, state) {
    return {
      ...state,

      lastTargetTemperature: props.targetTemperature,
      targetTemperature: (state.lastTargetTemperature === props.targetTemperature && state.targetTemperature) || props.targetTemperature
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

  setHeatingSlider = (el) => {
    if (el === null) {
      return;
    }

    el.addEventListener('touchmove', (e) => e.preventDefault(), false);
  };

  render() {
    if (!Array.isArray(this.props.data)) {
      return null;
    }

    const hoursHeatingActive = +((this.props.data.reduce((total, curr) => {
      if (curr.datum.isHeating) {
        total += curr.period.end - curr.period.start;
      }

      return total;
    }, 0) / 1000 / 60 / 60).toFixed(1));

    const marks = {
      10: 'Off',
      25: '25°C'
    };

    return (
      <div className={classnames('heating', {
        'heating--is-heating': this.props.isHeating
      })}>
        <h2 className="heating__title">{this.props.name}</h2>

        <div className="heating__container">
          <div className="heating__side">
            <div className="heating__slider" ref={this.setHeatingSlider}>
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
            <ThermostatHeatMap activity={this.props.data} />
            <div className="heating__details">
              <dl>
                <dt>Today</dt>
                <dd>
                  {hoursHeatingActive}hrs
                </dd>
              </dl>
              <dl>
                <dt>State</dt>
                <dd>{this.props.isHeating ? 'ON' : 'OFF'}</dd>
              </dl>
              <dl>
                <dt>Power</dt>
                <dd>{this.props.power}%</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const withSetTargetTemperature = graphql(gql`
  mutation updateThermostat($id: ID!, $targetTemperature: Float) {
    updateThermostat(id: $id, targetTemperature: $targetTemperature) {
      id
      name
      targetTemperature
      currentTemperature
      isHeating
      humidity
    }
  }
  `, {
  props: ({ mutate, ownProps: { id } }) => ({
    setTargetTemperature(targetTemperature) {
      mutate({
        variables: { id, targetTemperature }
      });
    }
  })
});

const withThermostatHistory = graphql(gql`
  query getHistory($ids: [ID!], $type: String, $from: Float!, $to: Float!, $interval: Float!) {
    getHistory(ids: $ids, type: $type, from: $from, to: $to, interval: $interval) {
      data {
        period {
          start
          end
        }

        datum {
          ...on Thermostat {
            isHeating
          }
        }
      }
    }
  }
`, {
  options({ id }) {
    return {
      variables: {
        ids: [id],
        type: 'thermostat',
        from: moment().startOf('day').valueOf(),
        to: moment().endOf('minute').valueOf(),
        interval: moment.duration(5, 'minute').asMilliseconds()
      },
    };
  },
  props: ({ data }) => ({ data: data?.getHistory?.data ?? [] })
});

export default withThermostatHistory(withSetTargetTemperature(Thermostat));