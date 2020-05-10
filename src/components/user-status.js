import React, { Component }  from 'react';
import moment from 'moment';
import classNames from 'classnames';
import { AWAY, HOME } from '../constants/status';
import { humanDate } from '../helpers/date';
import { connect } from 'react-redux';
import { showModal } from '../actions/modal';
import { ETA_PICKER } from '../constants/modals';
import { graphql } from '@apollo/react-hoc';
import gql from 'graphql-tag';

function mapDispatchToProps(dispatch, ownProps) {
  return {
    showModal: () => dispatch(showModal(ETA_PICKER, {
      id: ownProps.id,
      eta: ownProps.until ? moment(ownProps.until) : null
    }))
  };
}

class UserStatus extends Component {
  renderStatusMessage() {
    if (this.props.status === HOME) {
      const sinceMoment = moment(this.props.since);

      return `since ${sinceMoment.format('HH:mm')} ${humanDate(sinceMoment)}`;
    } else {
      const untilMoment = this.props.until ? moment(this.props.until) : null;

      const renderUntilMessage = () => {
        return (
          <a href="#" onClick={this.props.showModal}>
            {untilMoment && (
              <React.Fragment>
                {untilMoment.format('HH:mm')}
                &nbsp;
                {humanDate(untilMoment)}
              </React.Fragment>
            )}
            {!untilMoment && "unknown"}
          </a>
        );
      };

      return <React.Fragment>until {renderUntilMessage()}</React.Fragment>;
    }
  }

  render() {
    return (
      <div className="user-status">
        <a href="#" onClick={this.props.toggleStatus}>
          <img className={classNames('user-status__avatar', {
            'user-status__avatar--away': this.props.status === AWAY
          })} src={this.props.avatar} />
        </a>
        <div>
          <h3 className="user-status__user-name">
            {this.props.id}
          </h3>
          <p className="user-status__about">{this.renderStatusMessage()}</p>
        </div>
      </div>
    );
  }
}

export default graphql(gql`mutation($id: ID!, $status: Status) {
  updateUser(id:$id, status:$status) {
    id,
    status,
    since
  }
}`, {
  props({ mutate, ownProps }) {
    return {
      toggleStatus() {
        mutate({
          variables: {
            id: ownProps.id,
            status: ownProps.status === HOME ? AWAY : HOME
          }
        });
      }
    };
  }
})(connect(null, mapDispatchToProps)(UserStatus));