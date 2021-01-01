import React, { Component } from 'react';
import { graphql } from '@apollo/react-hoc';
import gql from 'graphql-tag';
import moment from 'moment';
import { FlexibleWidthXYPlot, XAxis, YAxis, HeatmapSeries } from 'react-vis';

const INTERVAL_SIZE_MS = moment.duration(15, 'minutes').asMilliseconds();

class LightingHistory extends Component {
  formatData() {
    const daysSinceEpoch = moment.duration(moment(Date.now()).startOf('day')).asDays();
    const data = [];

    // The "x" will be the 0-indexed 15 minute period and the "y" will be the
    // offset of the day, from today.
    for (let i=0;i<this.props.data.length;i++) {
      const { period, datum: { isOn }} = this.props.data[i];
      const startOfPeriod = moment(period.start);
      const startOfDay = moment(period.start).startOf('day');

      if (isOn) {
        data.push({
          y: daysSinceEpoch - moment.duration(startOfDay.valueOf()).asDays(),
          x: Math.floor(moment.duration(startOfPeriod.diff(startOfDay)).asMilliseconds() / INTERVAL_SIZE_MS)
        });
      }
    }

    return data;
  }

  render() {
    return (
      <React.Fragment>
        <h3>{this.props.name}</h3>

        {this.props.data && (
          <div className="light-history__plot">
            <FlexibleWidthXYPlot height={300} yType="ordinal" yDomain={[0, 1, 2, 3, 4, 5, 6]} xDomain={Array.from({ length: 96 }, (v, i) => i)} xType="ordinal" dontCheckIfEmpty>
              <XAxis tickFormat={v => v % 4 === 0 ? `${String(v / 4).padStart(2, '0')}:00` : ''}/>
              <YAxis tickFormat={v => moment().subtract(v, 'd').format('dd')[0]}/>
              <HeatmapSeries
                data={this.formatData()}
              />
            </FlexibleWidthXYPlot>
          </div>
        )}
      </React.Fragment>
    );
  }
}

export default graphql(gql`
  query getHistory($ids: [ID!], $type: String, $from: Float!, $to: Float!, $interval: Float!) {
    getHistory(ids: $ids, type: $type, from: $from, to: $to, interval: $interval) {
      data {
        period {
          start
          end
        }
        datum {
          ... on Light {
            isOn
          }
        }
      }
    }
  }
  `, {
  options: ({ id }) => ({
    variables: {
      ids: [id],
      type: 'light',
      from: moment().subtract(6, 'd').startOf('d').valueOf(),
      to: moment().valueOf(),
      interval: INTERVAL_SIZE_MS
    }
  }),
  props: ({ data: { getHistory }}) => ({ ...getHistory })
})(LightingHistory);