import React, { useState } from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons';
import gql from 'graphql-tag';
import { useMutation, useSubscription } from '@apollo/react-hooks';

export default function LightingTile({ id, name, isOn, brightness }) {
  const [setLightSwitchStatus] = useMutation(gql`
    mutation updateLight($id: ID!, $isOn: Boolean) {
      updateLight(id: $id, isOn: $isOn) {
        id
        name
        isOn
      }
    }
  `);

  useSubscription(gql`
    subscription onLightChanged($id: ID!) {
      onLightChanged(id: $id) {
        id
        name
        isOn
        brightness
      }
    }
  `, {
    variables: {
      id
    },

    onSubscriptionData({ subscriptionData: { data: { onLightChanged: { isOn }}}}) {
      if (desiredState === isOn) {
        setDesiredState(null);
      }
    }
  });

  const [desiredState, setDesiredState] = useState(null);
  const isLoading = desiredState !== null;

  return (
    <li key={id} className={classnames('lighting', { 'lighting--is-on': isOn })}>
      <div className={classnames('lighting__container', { 'lighting__container--is-on': isOn })} onClick={() => {
        if (isLoading) return;

        setLightSwitchStatus({ variables: { id, isOn: !isOn }});
        setDesiredState(!isOn);
      }}>
        <div className={classnames('lighting__loading-overlay', 'loading-spinner', isLoading && 'lighting__loading-overlay--visible')} />

        <span className="lighting__name">{name}</span>
        <span className="lighting__meta">
          <span className="lighting__brightness">{isOn ? `${brightness}%` : ''}</span>
          <span className="lighting__light"><FontAwesomeIcon icon={faLightbulb} /></span>
        </span>
      </div>
    </li>
  );
}