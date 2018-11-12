import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import resources from '../resources';
import { STATUS, TIMELINE} from '../../constants/resources';
import { getEvents } from '../../reducers/timeline';
import moment from 'moment';
import { connect } from 'react-redux';
import Event from '../event';

function mapStateToProps(state) {
  return {
    events: getEvents(state)
  };
}

@resources([ STATUS, TIMELINE ])
@connect(mapStateToProps)
export default class Timeline extends Component {
  *groupEventsByDays() {
    let i = 0;

    while (i !== this.props.events.length) {
      const date = {
        date: moment(this.props.events[i].timestamp).startOf('d'),
        events: []
      };

      do {
        date.events.push(this.props.events[i]);
        i = i + 1;
      } while (i !== this.props.events.length && moment(this.props.events[i].timestamp).isSame(date.date, 'd'));

      yield date;
    }
  }

  render() {
    const days = [...this.groupEventsByDays()];

    return (
      <div>
        <Header />
        <div>
          <SideBar/>
          <div className='body'>
            <ol className='timeline'>
              {days.map(({ date, events }, idx) => {
                return (
                  <li key={idx} className='day'>
                    <h3 className='day__header'>{date.format('dddd, MMMM Do YYYY')}</h3>

                     <ol className='events'>
                      {events.map((event) => {
                        return (
                          <li className='events__event' key={event.id}>
                            <Event
                              timeline={event.timeline}
                              recordingId={event.recordingId}
                            />
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}