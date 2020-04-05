import React, { useEffect } from 'react';
import LightingTile from './lighting-tile';
import gql from 'graphql-tag';
import { useQuery } from '@apollo/react-hooks';

export default function() {
  const { data, subscribeToMore } = useQuery(
    gql`{
      getLighting {
        lights {
          id,
          name,
          isOn
        }
      }
    }`
  );

  useEffect(() => {
    return subscribeToMore({
      document: gql`
        subscription {
          onLightChanged {
            id
            name
            isOn
          }
        }
      `,
      updateQuery({ getLighting: { lights }}, { subscriptionData: { data: { onLightChanged: changedLight }}}) {
        return {
          getLighting: {
            lights: lights.map(light => light.id === changedLight.id ? changedLight : light)
          }
        }
      }
    });
  });

  return (
    <ul>
      {data && data.getLighting.lights.map(({ id, name, isOn }) => <LightingTile id={id} name={name} isOn={isOn} />)}
    </ul>
  );
}