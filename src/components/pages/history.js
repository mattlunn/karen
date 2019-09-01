import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import gql from 'graphql-tag';
import { graphql } from 'react-apollo';
import moment from 'moment';
import { FlexibleWidthXYPlot, XAxis, YAxis, HeatmapSeries } from 'react-vis';

@graphql(gql`
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
})
class LightHistory extends Component {
  formatData() {
    const nowSinceEpoch = Math.floor(Date.now() / 8.64e+7);
    const buckets = 1000 * 60 * 15;
    const data = [];

    // For each "on" datum, walk through each of it's 15 minutes of being on,
    // and generate a data point for it. The "x" will be the 0-indexed 15 minute period
    // and the "y" will be the offset of the day, from today.
    for (const datum of this.props.data) {
      const start = Math.floor(datum.period.start / buckets);
      const end = Math.ceil(datum.period.end / buckets);

      for (let i=start; i<=end; i++) {
        const daySinceEpoch = Math.floor(i / (4 * 24));
        const bucketOfToday = i- (daySinceEpoch * 4 * 24);

        data.push({
          x: bucketOfToday,
          y: nowSinceEpoch - daySinceEpoch
        });
      }
    }

    return data;
  }

  render() {
    const day =  Date.now();

    return (
      <React.Fragment>
        <h4>{this.props.name}</h4>

        {this.props.data && (
          <FlexibleWidthXYPlot height={300} yType="ordinal" yDomain={[0, 1, 2, 3, 4, 5, 6]} xDomain={Array.from({ length: 96 }, (v, i) => i)} xType="ordinal" dontCheckIfEmpty>
            <XAxis tickFormat={v => v % 4 === 0 ? `${String(v / 4).padStart(2, '0')}:00` : ''}/>
            <YAxis tickFormat={v => moment().subtract(v, 'd').format('dd')[0]}/>
            <HeatmapSeries
              data={this.formatData()}
            />
          </FlexibleWidthXYPlot>
        )}
      </React.Fragment>
    );
  }
}

@graphql(gql`{
  getLighting {
    lights {
      id,
      name
    }
  }
}`, {
  props: ({ data: { getLighting }}) => ({ ...getLighting })
})
export default class History extends Component {
  render() {
    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body body--history'>
            <h3>Lighting</h3>

            {this.props.lights && this.props.lights.map(light => <LightHistory id={light.id} name={light.name} />)}
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}