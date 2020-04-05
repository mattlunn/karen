import React, { Component } from 'react';
import { connect } from 'react-redux';
import { getActiveModalProps } from '../../reducers/modal';
import { closeModal } from '../../actions/modal';
import { ETA_PICKER } from '../../constants/modals';
import { range } from '../../helpers/iterable';
import pad from 'left-pad';
import Calendar from 'react-calendar'
import moment from 'moment';
import gql from 'graphql-tag';
import { graphql } from '@apollo/react-hoc';

function mapStateToProps(state) {
  return getActiveModalProps(state);
}

function mapDispatchToProps(dispatch, ownProps) {
  return {
    closeModal: () => dispatch(closeModal(ETA_PICKER))
  };
}

@connect(mapStateToProps, mapDispatchToProps)
@graphql(gql`mutation($id: ID!, $eta: Float) {
  updateUser(id: $id, eta: $eta) {
    id,
    until
  }
}`, {
  props({ mutate, ownProps }) {
    return {
      setEta(id, eta) {
        mutate({
          variables: {
            id,
            eta: +eta
          }
        }).then(() => {
          ownProps.closeModal();
        });
      }
    }
  }
})
export default class EtaPicker extends Component {
  constructor(props) {
    super(props);

    this.state = {
      date: props.eta ? moment(props.eta) : moment().startOf('day')
    };
  }

  handleCalendarChange = (value) => {
    const newDate = moment(value).hour(this.state.date.hour()).minute(this.state.date.minute());

    this.setState({
      date: newDate
    });
  };

  handleSelectChange = (e) => {
    this.setState({
      date: moment(this.state.date)[e.target.name](e.target.options[e.target.selectedIndex].value)
    });
  };

  setEta = () => {
    this.props.setEta(this.props.id, this.state.date);
  };

  render() {
    return (
      <div className="eta-picker">
        <div className="eta-picker__body">
          <h2>When will <strong>{this.props.id}</strong> be home?</h2>

          <div>
            <Calendar onChange={this.handleCalendarChange} minDate={new Date()} value={this.state.date.toDate()} />
          </div>
          <div className="eta-picker__selected-date-and-time">
            <div className="eta-picker__selected-date">
              {this.state.date.format('DD/MM/YYYY')}
            </div>
            <div className="eta-picker__selected_time">
              at&nbsp;
              <select onChange={this.handleSelectChange} name="hour" value={this.state.date.hour()}>
                {Array.from(range(0, 24)).map(x => <option value={x} key={x}>{pad(x, 2, '0')}</option>)}
              </select>
              :
              <select onChange={this.handleSelectChange} name="minute" value={this.state.date.minute()}>
                {Array.from(range(0, 60, 5)).map(x => <option value={x} key={x}>{pad(x, 2, '0')}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="eta-picker__footer">
          <button className="secondary" onClick={this.props.closeModal}>Cancel</button>
          <button className="primary" onClick={this.setEta}>Ok</button>
        </div>
      </div>
    );
  }
}