import React, { Component } from 'react';
import moment from 'moment';

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

    return (
      <div className="heating-heat-map">
        {this.props.activity.map((activity) => {
          return (
            <div
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
    );
  }
}