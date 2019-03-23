import React, { Component } from 'react';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons';
import { graphql } from 'react-apollo';
import gql from 'graphql-tag';

@graphql(gql`{
  getLighting {
    lights {
      id,
      name,
      isOn
    }
  }
}`, {
  props: ({ data: { getLighting }}) => ({ ...getLighting })
})
@graphql(gql`
  mutation updateLight($id: ID!, $isOn: Boolean) {
    updateLight(id: $id, isOn: $isOn) {
      lights {
        id
        name
        isOn
      }
    }
  }
`, {
  props: ({ mutate }) => ({
    setLightSwitchStatus(id, isOn) {
      mutate({
        variables: { id, isOn }
      });
    }
  })
})
export default class Lighting extends Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <ul>
        {this.props.lights && this.props.lights.map((light, idx) => {
          return (
            <li key={idx} className={classnames('lighting', { 'lighting--is-on': light.isOn })}>
              <div className={classnames('lighting__container', { 'lighting__container--is-on': light.isOn })} onClick={() => this.props.setLightSwitchStatus(light.id, !light.isOn)}>
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
}