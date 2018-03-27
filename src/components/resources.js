import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getLoadedResources } from '../reducers/resources';
import { fetchResource } from '../actions/resources';

export default function(requestedResources) {
  function mapStateToProps(state) {
    return {
      resources: getLoadedResources(state.resources, requestedResources)
    };
  }

  @connect(mapStateToProps, {
    fetchResource
  })
  class Loader extends Component {
    componentDidMount() {
      for (const resource of requestedResources) {
        if (!this.props.resources.includes(resource)) {
          this.props.fetchResource(resource);
        }
      }
    }

    render() {
      if (this.props.resources.length === requestedResources.length) {
        return <h1>{this.props.children}</h1>
      } else {
        return (
          <div className="resource-loader__loading-spinner">
            <div className='loading-spinner' />
          </div>
        );
      }
    }
  }

  return Component => () => <Loader><Component /></Loader>
}