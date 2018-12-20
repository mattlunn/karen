import React, { Component } from 'react';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default class Event extends Component {
  constructor() {
    super();

    this.state = { panel: null };
  }

  render() {
    return (
      <React.Fragment>
        <span class="event__timestamp">{moment(this.props.timestamp).format('HH:mm:ss')}</span>

        <span className="event__icon"><FontAwesomeIcon icon={this.props.icon} /></span>

        {this.props.title}

        {this.props.controls && (
          <span className="event__buttons">
            {this.props.controls({
              openPanel: (panel) => this.setState({ panel }),
              closePanel: () => this.setState({ panel: null }),
              togglePanel: (panel) => this.setState({ panel: this.state.panel === panel ? null : panel })
            }).map((control, idx) => {
              return (
                <React.Fragment>
                  {idx !== 0 && <React.Fragment>&nbsp;&bull;&nbsp;</React.Fragment>}
                  {control}
                </React.Fragment>
              );
            })}
          </span>
        )}

        {this.state.panel && (
          <div className="event__panel">
            {this.props.panels[this.state.panel]}
          </div>
        )}
      </React.Fragment>
    );
  }
}