import React, { useState } from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons';
import gql from 'graphql-tag';
import { useMutation } from '@apollo/react-hooks';

export default function({ id, name, isOn }) {
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

  const [desiredState, setDesiredState] = useState(isOn);
  const isLoading = desiredState !== isOn;

  return (
    <li key={id} className={classnames('lighting', { 'lighting--is-on': isOn })}>
      <div className={classnames('lighting__container', { 'lighting__container--is-on': isOn })} onClick={() => {
        if (isLoading) return;

        setLightSwitchStatus({ variables: { id, isOn: !isOn }});
        setDesiredState(!isOn);
      }}>
        <div className={classnames('lighting__loading-overlay', 'loading-spinner', isLoading && 'lighting__loading-overlay--visible')} />

        <span className="lighting__name">{name}</span>
        <span className="lighting__light">
          <FontAwesomeIcon icon={faLightbulb} />
        </span>
      </div>
    </li>
  );
}