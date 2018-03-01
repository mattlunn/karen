import React from 'react';
import classNames from 'classnames';
import { AWAY, HOME } from '../constants/status';
import moment from 'moment';
import { humanDate } from '../helpers/date';

function renderStatusMessage(status, since, until) {
  if (status === HOME) {
    const sinceMoment = moment(since);

    return `since ${sinceMoment.format('HH:mm')} ${humanDate(sinceMoment)}`;
  } else {
    const untilMoment = until ? moment(until) : null;

    const renderUntilMessage = () => {
      if (untilMoment) {
        return (
          <React.Fragment>
            <a href="#">{untilMoment.format('HH:mm')}</a>
            &nbsp;
            <a href="#">{humanDate(untilMoment)}</a>
          </React.Fragment>
        );
      } else {
        return <a href="#">unknown</a>;
      }
    };

    return <React.Fragment>until {renderUntilMessage()}</React.Fragment>;
  }
}

export default function ({ handle, status, avatar, since, until }) {
  return (
    <div className="user-status">
      <img className={classNames('user-status__avatar', {
        'user-status__avatar--away': status === AWAY
      })} src={avatar} />

      <div>
        <h3 className="user-status__user-name">
          {handle}
        </h3>
        <p className="user-status__about">{renderStatusMessage(status, since, until)}</p>
      </div>
    </div>
  );
}