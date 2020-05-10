import React, { Component } from 'react';
import { graphql } from '@apollo/react-hoc';
import gql from 'graphql-tag';
import moment from 'moment';
import { FlexibleWidthXYPlot, XAxis, YAxis, HeatmapSeries } from 'react-vis';

class LightingHistory extends Component {
  formatData() {
    const daysSinceEpoch = Math.floor(Date.now() / 8.64e+7);
    const bucketSize = 1000 * 60 * 15;
    const getDstAdjustedBucket = (time) => (time + (moment(time).utcOffset() * 60 * 1000)) / bucketSize;
    const data = [];

    // For each "on" datum, walk through each of it's 15 minutes of being on,
    // and generate a data point for it. The "x" will be the 0-indexed 15 minute period
    // and the "y" will be the offset of the day, from today.
    for (const datum of this.props.data) {
      const start = Math.floor(getDstAdjustedBucket(datum.period.start));
      const end = Math.ceil(getDstAdjustedBucket(datum.period.end));

      for (let i=start; i<end; i++) {
        const daySinceEpoch = Math.floor(i / (4 * 24));
        const bucketOfToday = i- (daySinceEpoch * 4 * 24);

        data.push({
          x: bucketOfToday,
          y: daysSinceEpoch - daySinceEpoch
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
  query getHistory($id: ID!, $type: String, $from: Float!, $to: Float!) {
    getHistory(id: $id, type: $type, from: $from, to: $to) {
      data {
        period {
          start
          end
        }

        value
      }
    }
  }
  `, {
  options: ({ id }) => ({
    variables: {
      id,
      type: 'on',
      from: moment().subtract(6, 'd').startOf('d').valueOf(),
      to: moment().endOf('d').valueOf()
    },
  }),
  props: ({ data: { getHistory }}) => ({ ...getHistory })
})(LightingHistory);