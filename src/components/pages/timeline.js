import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import resources from '../resources';
import { TIMELINE} from '../../constants/resources';
import { getEvents, getIsLoadingMoreEvents, getHasMoreEvents } from '../../reducers/timeline';
import { loadMoreTimelineEvents } from '../../actions/timeline';
import moment from 'moment';
import { connect } from 'react-redux';
import Event from '../event';
import { faWalking } from '@fortawesome/free-solid-svg-icons/faWalking';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';

function mapStateToProps(state) {
  return {
    events: getEvents(state),
    isLoadingMoreEvents: getIsLoadingMoreEvents(state),
    hasMoreEvents: getHasMoreEvents(state)
  };
}

@resources([ TIMELINE ])
@connect(mapStateToProps, {
  loadMoreTimelineEvents
})
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

  handleScroll = () => {
    if (!this.props.isLoadingMoreEvents && this.props.hasMoreEvents && window.pageYOffset + window.innerHeight > Math.max(
      document.body.scrollHeight, document.documentElement.scrollHeight,
      document.body.offsetHeight, document.documentElement.offsetHeight,
      document.body.clientHeight, document.documentElement.clientHeight
    ) - 200) {
      this.props.loadMoreTimelineEvents();
    }
  }

  componentWillMount() {
    window.addEventListener('scroll', this.handleScroll);
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleScroll);
  }

  createEvent(event) {
    switch (event.type) {
      case 'motion':
        return (
          <Event
            timestamp={event.timestamp}
            title={"Motion detected"}
            icon={faVideo}
            controls={({ togglePanel }) => {
              return event.recordingId ? [
                <a onClick={(e) => {
                  e.preventDefault();
                  togglePanel('view');
                }} href="#" className="card-link">view</a>,
                <a href={"/recording/" + event.recordingId + "?download=true"} className="card-link">download</a>
              ] : []
            }}
            panels={{
              view: (
                <video
                  width="100%"
                  controls
                  src={"/recording/" + event.recordingId}
                />
              )
            }}
          />
        );
      case 'departure':
        return (
          <Event
            timestamp={event.timestamp}
            icon={faWalking}
            title={event.user + ' left the house'}
          />
        );
      case 'arrival':
        return (
          <Event
            timestamp={event.timestamp}
            icon={faHome}
            title={event.user + ' arrived home'}
          />
        );
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
                      {events.map((event, idx) => {
                        return (
                          <li className='event' key={idx}>
                            {this.createEvent(event)}
                          </li>
                        );
                      })}
                    </ol>
                  </li>
                );
              })}
            </ol>

            {this.props.isLoadingMoreEvents && <div className='loading-spinner timeline__loader' />}
          </div>
        </div>

        <Modals />
      </div>
    );
  }
}