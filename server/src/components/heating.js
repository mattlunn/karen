import React, { useEffect } from 'react';
import Thermostat from './thermostat';
import gql from 'graphql-tag';
import { useQuery } from '@apollo/react-hooks';

export default function Heating() {
  const { data, subscribeToMore } = useQuery(gql`
    query getHeating {
      getHeating {
        thermostats {
          id
          name
          targetTemperature
          currentTemperature
          isHeating
          power,
          humidity
        }
      }
    }
  `);

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
            power,
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
      {data && data.getHeating.thermostats.map((thermostat, index) => {
        return (
          <Thermostat key={index} {...thermostat} />
        );
      })}
    </div>
  );
}