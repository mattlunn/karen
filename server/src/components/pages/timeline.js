import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Center, Loader, Title } from '@mantine/core';
import dayjs from '../../dayjs';
import Event from '../event';
import styles from './timeline.module.css';
import { faWalking } from '@fortawesome/free-solid-svg-icons/faWalking';
import { faEye } from '@fortawesome/free-solid-svg-icons/faEye';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons/faLightbulb';
import { faShieldAlt } from '@fortawesome/free-solid-svg-icons/faShieldAlt';
import { faBell } from '@fortawesome/free-solid-svg-icons/faBell';

function groupEventsByDays(events) {
  const days = [];
  let i = 0;

  while (i !== events.length) {
    const day = {
      date: dayjs(events[i].timestamp).startOf('d'),
      events: []
    };

    do {
      day.events.push(events[i]);
      i = i + 1;
    } while (i !== events.length && dayjs(events[i].timestamp).isSame(day.date, 'd'));

    days.push(day);
  }

  return days;
}

function createEvent(event) {
  switch (event.type) {
    case 'motion':
      return (
        <Event
          timestamp={event.timestamp}
          title={`Motion detected by "${event.device.name}"`}
          icon={faEye}
          renderControls={({ togglePanel }) => {
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
    case 'departure':
      return (
        <Event
          timestamp={event.timestamp}
          icon={faWalking}
          title={`${event.user.id} left the house`}
        />
      );
    case 'arrival':
      return (
        <Event
          timestamp={event.timestamp}
          icon={faHome}
          title={`${event.user.id} arrived home`}
        />
      );
    case 'light-on':
      return (
        <Event
          timestamp={event.timestamp}
          icon={faLightbulb}
          title={`The "${event.device.name}" light was switched on`}
        />
      );
    case 'light-off':
      return (
        <Event
          timestamp={event.timestamp}
          icon={faLightbulb}
          title={`The "${event.device.name}" light was switched off after being on for ${Math.ceil(event.duration / 60)} minutes`}
        />
      );
    case 'alarm-arming': {
      return (
        <Event
          timestamp={event.timestamp}
          icon={faShieldAlt}
          title={`The alarm was ${event.mode === 'OFF' ? 'turned off' : 'set to ' + event.mode.toLowerCase()}`}
        />
      );
    }
    case 'doorbell-ring': {
      return (
        <Event
          timestamp={event.timestamp}
          icon={faBell}
          title={`Someone rang the doorbell`}
          renderControls={({ togglePanel }) => {
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

export default function Timeline() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const fetchEvents = useCallback(async (since) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/timeline?since=${since}&limit=100`);
      if (!res.ok) throw new Error(res.status.toString());
      const data = await res.json();

      setEvents(prev => since === Date.now() ? data.events : [...prev, ...data.events]);
      setHasMore(data.hasMore);
    } catch (err) {
      console.error('Failed to load timeline:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents(Date.now());
  }, [fetchEvents]);

  useEffect(() => {
    function handleScroll() {
      if (!loading && hasMore && window.pageYOffset + window.innerHeight > Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      ) - 200) {
        if (events.length > 0) {
          fetchEvents(events[events.length - 1].timestamp);
        }
      }
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, events, fetchEvents]);

  const days = useMemo(() => groupEventsByDays(events), [events]);

  return (
    <>
      <ol className={styles.root}>
        {days.map(({ date, events }, idx) => {
          return (
            <li key={idx}>
              <Title order={3} className={styles.dayHeader}>{date.format('dddd, MMMM Do YYYY')}</Title>

               <ol>
                {events.map((event, idx) => {
                  return (
                    <li className={styles.event} key={idx}>
                      {createEvent(event)}
                    </li>
                  );
                })}
              </ol>
            </li>
          );
        })}
      </ol>

      {loading && (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      )}
    </>
  );
}
