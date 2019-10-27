import React, { useEffect } from 'react';
import Thermostat from './thermostat';
import gql from 'graphql-tag';
import moment from 'moment-timezone';
import { useQuery } from '@apollo/react-hooks';

export default function() {
  const { data, subscribeToMore } = useQuery(gql`
    query ($start: Float!, $end: Float!) {
      getHeating {
        thermostats {
          id
          name
          targetTemperature
          currentTemperature
          isHeating
          humidity
          heatingHistory(start: $start, end: $end) {
            start
            end
          }
        }
      }
    }
  `, {
    variables: {
      start: moment().startOf('day').valueOf(),
      end: moment().endOf('minute').valueOf()
    }
  });

  useEffect(() => {
    return subscribeToMore({
      document: gql`
        subscription {
          onThermostatChanged {
            id
            name
            targetTemperature
            currentTemperature
            isHeating
            humidity
          }
        }
      `,
      updateQuery(prev, { subscriptionData: { data: { onThermostatChanged }}} ) {
        return {
          getHeating: {
            __typename: 'Heating',
            thermostats: prev.getHeating.thermostats.map(t => {
              return t.id === onThermostatChanged.id ? { ...t, ...onThermostatChanged } : t;
            })
          }
        };
      }
    });
  });

  return (
    <div>
      {data && data.getHeating.thermostats.map(thermostat => {
        return (
          <Thermostat {...thermostat} />
        );
      })}
    </div>
  );
}