import React, { Component } from 'react';
import classnames from 'classnames';

const MINUTES_IN_A_DAY = 1440;
const INTERVAL_SIZE_MINS = 5;

export default class HeatingHeatMap extends Component {
  render() {
    const hours = [];

    for (let hour=1;hour<24;hour++) {
      hours.push(
        <div
          className={classnames('heating-heat-map__marker', {
            'heating-heat-map__marker--quarter': hour % 3 === 0
          })}
          style={{
            left: `${(hour * 100) / 24}%`
          }}
        >
          {hour.toString().length === 2 ? hour : `0${hour}`}
        </div>
      );
    }

    return (
      <div className="heating-heat-map">
        <div className="heating-heat-map__map">
          {this.props.activity.map(({ datum: { isHeating }}, index) => {
            return (
              <div
                key={index}
                className={classnames('heating-heat-map__segment', { 'heating-heat-map__segment--heating': isHeating })}
                style={{
                  width: ((INTERVAL_SIZE_MINS * 100) / MINUTES_IN_A_DAY) + '%',
                  backgroundColor: isHeating ? this.props.colorMask : ''
                }}
              />
            );
          })}

          <div
            className="heating-heat-map__rest-of-day"
            style={{
              width: ((1 - ((this.props.activity.length * INTERVAL_SIZE_MINS) / MINUTES_IN_A_DAY)) * 100) + '%'
            }}
          />
        </div>
        {this.props.withHours === false ? '' : <div className="heating-heat-map__markers">{hours}</div>}
      </div>
    );
  }
}