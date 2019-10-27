import React, { Component } from 'react';
import Thermostat from './thermostat';
import { graphql } from '@apollo/react-hoc';
import gql from 'graphql-tag';
import moment from 'moment-timezone';

@graphql(gql`
  query ($start: Float!, $end: Float!) {
    getHeating {
      thermostats {
        id
        name
        targetTemperature
        currentTemperature
        isHeating
        humidity
        eta
        isHome
        heatingHistory(start: $start, end: $end) {
          start
          end
        }
      }
    }
  }
`, {
  props: ({ data: { getHeating }}) => ({ ...getHeating }),
  options: {
    variables: {
      start: moment().startOf('day').valueOf(),
      end: moment().valueOf()
    }
  }
})
export default class Heating extends Component {
  render() {
    return (
      <div>
        {this.props.thermostats && this.props.thermostats.map(thermostat => {
          return (
            <Thermostat {...thermostat} />
          );
        })}
      </div>
    );
  }
}