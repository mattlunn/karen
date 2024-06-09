import React, { Component } from 'react';
import { connect } from 'react-redux';
import gql from 'graphql-tag';
import { graphql } from '@apollo/react-hoc';

function mapStateToProps() {
  return {
    loadSnapshot: async (snapshot) => {
      const response = await fetch(snapshot, {
        credentials: 'same-origin'
      });

      return URL.createObjectURL(await response.blob());
    }
  };
}

class Security extends Component {
  constructor() {
    super();

    this.loading = {};
    this.state = {
      snapshots: {}
    };
  }

  loadCameraImages = () => {
    if (this.props.cameras) {
      this.props.cameras.forEach(async (camera) => {
        if (this.loading[camera.id]) {
          return;
        }

        this.loading[camera.id] = true;

        try {
          const snapshot = await this.props.loadSnapshot(camera.snapshot);

          this.setState({
            snapshots: {
              ...this.state.snapshots,

              [camera.id]: snapshot
            }
          });
        } finally {
          this.loading[camera.id] = false;
        }
      });
    }
  };

  componentDidMount() {
    this.interval = setInterval(this.loadCameraImages, 5000);
    this.loadCameraImages();
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    return (
      <div className="security">
        <ul className="security__camera-list">
          {this.props.cameras && this.props.cameras.map((camera) => {
            return (
              <li className="security__camera" key={camera.id}>
                <h3>{camera.name}</h3>
                <img
                  className="loading-spinner"
                  src={this.state.snapshots[camera.id] || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAQAAACRI2S5AAAAEElEQVR42mNkIAAYRxWAAQAG9gAKqv6+AwAAAABJRU5ErkJggg=='}
                />
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
}

export default graphql(gql`{
  getSecurityStatus {
    cameras {
      id,
      snapshot,
      name
    }
  }
}`, {
  props: ({ data: { getSecurityStatus }}) => ({ ...getSecurityStatus })
})(connect(mapStateToProps)(Security));