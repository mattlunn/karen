import React, { Component } from 'react';
import moment from 'moment';
import classnames from 'classnames';

export default class HeatingHeatMap extends Component {
  render() {
    const dateAsIncrementingPercentage = (() => {
      const SECONDS_PER_DAY = 60 * 60 * 24;
      let curr = 0;

      return (date) => {
        const percentage = (moment(date).diff(moment(date).startOf('day'), 'seconds') / SECONDS_PER_DAY) - curr;

        curr += percentage;

        return `${percentage * 100}%`;
      };
    })();

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
          {this.props.activity.map((activity, index) => {
            return (
              <div
                key={index}
                className="heating-heat-map__heat-segment"
                style={{
                  marginLeft: dateAsIncrementingPercentage(activity.start),
                  width: dateAsIncrementingPercentage(activity.end)
                }}
              />
            );
          })}

          <div
            className="heating-heat-map__rest-of-day"
            style={{
              marginLeft: dateAsIncrementingPercentage(new Date()),
              width: dateAsIncrementingPercentage(moment().endOf('day'))
            }}
          />
        </div>
        <div className="heating-heat-map__markers">{hours}</div>
      </div>
    );
  }
}