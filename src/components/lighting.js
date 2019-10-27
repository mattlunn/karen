import React, { useEffect } from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons';
import gql from 'graphql-tag';
import { useQuery, useMutation } from '@apollo/react-hooks';

export default function() {
  const [setLightSwitchStatus] = useMutation(gql`
    mutation updateLight($id: ID!, $isOn: Boolean) {
      updateLight(id: $id, isOn: $isOn) {
        lights {
          id
          name
          isOn
        }
      }
    }
  `);

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
      {data && data.getLighting.lights.map((light, idx) => {
        return (
          <li key={idx} className={classnames('lighting', { 'lighting--is-on': light.isOn })}>
            <div className={classnames('lighting__container', { 'lighting__container--is-on': light.isOn })} onClick={() => setLightSwitchStatus({ variables: { id: light.id, isOn: !light.isOn }})}>
              <span className="lighting__name">{light.name}</span>
              <span className="lighting__light">
                <FontAwesomeIcon icon={faLightbulb} />
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}