import React, { Component } from 'react';
import SideBar from '../sidebar';
import Modals from '../modals';
import Header from '../header';
import moment from 'moment';
import Event from '../event';
import { faWalking } from '@fortawesome/free-solid-svg-icons/faWalking';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faShieldAlt } from '@fortawesome/free-solid-svg-icons/faShieldAlt';
import { faBell } from '@fortawesome/free-solid-svg-icons/faBell';
import { graphql } from '@apollo/client/react/hoc';
import gql from 'graphql-tag';

class Timeline extends Component {
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
  };

  UNSAFE_componentWillMount() {
    window.addEventListener('scroll', this.handleScroll);
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleScroll);
  }

  createEvent(event) {
    switch (event.__typename) {
      case 'MotionEvent':
        return (
          <Event
            timestamp={event.timestamp}
            title={`Motion detected by "${event.device.name}"`}
            icon={faEye}
            controls={({ togglePanel }) => {
              return event.recording ? [
                <a key={0} onClick={(e) => {
                  e.preventDefault();
                  togglePanel('view');
                }} href="#" className="card-link">view</a>,
                <a key={1} href={`/api/recording/${event.recording.id}?download=true`} className="card-link">download</a>
              ] : [];
            }}
            panels={{
              view: (
                <video
                  width="100%"
                  controls
                  src={`/api/recording/${event.recording?.id}`}
                />
              )
            }}
          />
        );
      case 'DepartureEvent':
        return (
          <Event
            timestamp={event.timestamp}
            icon={faWalking}
            title={`${event.user.id} left the house`}
          />
        );
      case 'ArrivalEvent':
        return (
          <Event
            timestamp={event.timestamp}
            icon={faHome}
            title={`${event.user.id} arrived home`}
          />
        );
      case 'LightOnEvent':
        return (
          <Event
            timestamp={event.timestamp}
            icon={faLightbulb}
            title={`The "${event.device.name}" light was switched on`}
          />
        );
      case 'LightOffEvent':
        return (
          <Event
            timestamp={event.timestamp}
            icon={faLightbulb}
            title={`The "${event.device.name}" light was switched off after being on for ${Math.ceil(event.duration / 60)} minutes`}
          />
        );
      case 'AlarmArmingEvent': {
        return (
          <Event
            timestamp={event.timestamp}
            icon={faShieldAlt}
            title={`The alarm was ${event.mode === 'OFF' ? 'turned off' : 'set to ' + event.mode.toLowerCase()}`}
          />
        );
      }
      case 'DoorbellRingEvent': {
        return (
          <Event
            timestamp={event.timestamp}
            icon={faBell}
            title={`Someone rang the doorbell`}
            controls={({ togglePanel }) => {
              return [
                <a key={0} onClick={(e) => {
                  e.preventDefault();
                  togglePanel('view');
                }} href="#" className="card-link">view</a>
              ];
            }}
            panels={{
              view: (
                <img
                  width="100%"
                  src={`/api/event/${event.id}/thumbnail`}
                />
              )
            }}
          />
        );
      }
    }
  }

  render() {
    const days = [...this.groupEventsByDays()];

    return (
      <div>
        <Header />
        <div>
          <SideBar hideOnMobile />
          <div className='body body--with-padding'>
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


export default graphql(gql`
  query getTimeline($since: Float!, $limit: Int!) {
    getTimeline(since: $since, limit: $limit) {
      ...on Event {
        id
        timestamp
      }

      ...on MotionEvent {
        recording {
          id
        }

        device {
          id
          name
        }
      }

      ...on ArrivalEvent {
        id
        timestamp
        user {
          id
        }
      }

      ...on DepartureEvent {
        id
        timestamp
        user {
          id
        }
      }

      ...on LightOffEvent {
        device {
          id
          name
        }

        duration
      }

      ...on LightOnEvent {
        device {
          id
          name
        }
      }

      ...on AlarmArmingEvent {
        timestamp
        mode
      }

      ...on DoorbellRingEvent {
        id
        timestamp
      }
    }
  }
`, {
  props: ({ data: { getTimeline: events = [], fetchMore, networkStatus }}) => {
    const isLoadingMoreEvents = networkStatus === 3;

    return {
      events,
      isLoadingMoreEvents,

      hasMoreEvents: !!events.length,

      loadMoreTimelineEvents() {
        if (isLoadingMoreEvents) {
          return;
        }

        return fetchMore({
          variables: {
            limit: 100,
            since: events[events.length - 1].timestamp
          },

          updateQuery(previousResult, { fetchMoreResult }) {
            return {
              ...previousResult,

              getTimeline: previousResult.getTimeline.concat(fetchMoreResult.getTimeline)
            };
          }
        });
      }
    };
  },

  options: {
    variables: {
      limit: 100,
      since: Date.now()
    },

    notifyOnNetworkStatusChange: true
  }
})(Timeline);