import React, { Component } from 'react';
import TimePickerDialog from 'material-ui/TimePicker/TimePickerDialog';
import DatePickerDialog from 'material-ui/DatePicker/DatePickerDialog';
import classnames from 'classnames';
import moment from 'moment';
import { connect } from 'react-redux';
import { getStatus, getStatusSince, getStatusUntil } from '../reducers/stay';
import { HOME, AWAY } from '../constants/status';
import { humanDate } from '../helpers/date';
import { changeStayStatus } from '../actions/stay';

function mapStateToProps(state) {
  return {
    status: getStatus(state.stay),
    since: getStatusSince(state.stay),
    until: getStatusUntil(state.stay)
  };
}

@connect(mapStateToProps, {
  changeStayStatus
})
export default class SideBar extends Component {
  openTimePickerDialog = () => {
    this.timePickerDialog.show();
  };

  openDatePickerDialog = () => {
    this.datePickerDialog.show();
  };

  openTimeThenDatePickerDialog = () => {
    this.timePickerDialog.show();
  };

  renderStatusMessage() {
    if (this.props.status === HOME) {
      const since = moment(this.props.since);

      return `Home since ${since.format('HH:mm')} ${humanDate(since)}`;
    } else {
      const since = moment(this.props.since);
      const until = this.props.until ? moment(this.props.until) : null;

      const renderUntilMessage = () => {
        if (until) {
          return [
            <a href="#" onClick={this.openTimePickerDialog}>{until.format('HH:mm')}</a>,
            ' ',
            <a href="#" onClick={this.openDatePickerDialog}>{humanDate(until)}</a>
          ];
        } else {
          return [
            <a href="#" onClick={this.openTimeThenDatePickerDialog}>unknown</a>,
          ]
        }
      };

      return [
        `Away from ${since.format('HH:mm')} ${humanDate(since)} until `,
        ...renderUntilMessage()
      ];
    }
  }

  toggleStatus = () => {
    this.props.changeStayStatus(this.props.status === AWAY ? HOME : AWAY);
  };

  render() {
    return (
      <div className="sidebar">
        <div className="sidebar__house">
          <div className={classnames('sidebar__house-border', {
            'sidebar__house-border--away': this.props.status === AWAY
          })} onClick={this.toggleStatus}>
            <div className={classnames('house', {
              'house--away': this.props.status === AWAY
            })} />
          </div>
        </div>

        <h2>Effra Road</h2>

        <p className="sidebar__status">
          {this.renderStatusMessage()}
        </p>

        <TimePickerDialog 
          ref={(dialog) => this.timePickerDialog = dialog}
          format="ampm" 
          initialTime={this.props.until || new Date()}
          autoOk={false}
          disabled={false}
          pedantic={false}
          minutesStep={5}
        />

        <DatePickerDialog
          ref={(dialog) => this.datePickerDialog = dialog}
          autoOk={false}
          container='dialog'
          disableYearSelection={true}
          firstDayOfWeek={1}
          initialDate={this.props.until || new Date()}
          hideCalendarDate={false}
          openToYearSelection={false}
        />
      </div>
    );
  }
}