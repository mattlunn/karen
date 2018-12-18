import React, { Component } from 'react';
import moment from 'moment';

export default class Event extends Component {
  constructor() {
    super();

    this.state = { showVideo: false };
  }

  toggleVideo = (e)  => {
    var showVideo = !this.state.showVideo;

    e.preventDefault();

    this.setState({
      showVideo: showVideo
    });

    this.player.play();
  }

  renderVideoElement() {
    if (this.props.recordingId) {
      return (
        <video
          width="100%"
          ref={(player) => this.player = player}
          preload="none"
          className={this.state.showVideo ? 'events__video--visible' : 'events__video'}
          controls
          src={"/recording/" + this.props.recordingId}
        />
      );
    }

    return null;
  }

  render() {
    return (
      <React.Fragment>
        <span class='events__event-timestamp'>{moment(this.props.timestamp).format('DD:mm:ss')}</span>

        {this.props.recordingId && (
          <React.Fragment>
            <span className="events__event-buttons">
              <a onClick={this.toggleVideo} href="#" className="card-link">view</a>
              &nbsp;&bull;&nbsp;
              <a href={"/recording/" + this.props.recordingId + "?download=true"} className="card-link">download</a>
            </span>

            <div>
              {this.renderVideoElement()}
            </div>
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }
}