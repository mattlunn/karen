import React, { useEffect, useMemo } from 'react';
import { Center, Loader } from '@mantine/core';
import { useInfiniteQuery } from '@tanstack/react-query';
import Event from '../event';
import Timeline from '../timeline/timeline';
import { faWalking, faEye, faHome, faLightbulb, faShieldAlt, faBell } from '@fortawesome/free-solid-svg-icons';

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

export default function TimelinePage() {
  const {
    data,
    isFetching,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['timeline'],
    queryFn: ({ pageParam }) =>
      fetch(`/api/timeline?since=${pageParam ?? Date.now()}&limit=100`).then(r => r.json()),
    initialPageParam: null,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore || lastPage.events.length === 0) return undefined;
      return lastPage.events[lastPage.events.length - 1].timestamp;
    },
  });

  const events = useMemo(() => data?.pages.flatMap(page => page.events) ?? [], [data]);

  useEffect(() => {
    function handleScroll() {
      if (!isFetching && hasNextPage && window.pageYOffset + window.innerHeight > Math.max(
        document.body.scrollHeight, document.documentElement.scrollHeight,
        document.body.offsetHeight, document.documentElement.offsetHeight,
        document.body.clientHeight, document.documentElement.clientHeight
      ) - 200) {
        fetchNextPage();
      }
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isFetching, hasNextPage, fetchNextPage]);

  const items = useMemo(() => {
    return events.flatMap(event => {
      const component = createEvent(event);
      return component ? [{ timestamp: event.timestamp, component }] : [];
    });
  }, [events]);

  return (
    <>
      <Timeline items={items} dayHeaderOrder={3} />

      {isFetching && (
        <Center py="xl">
          <Loader size="lg" />
        </Center>
      )}
    </>
  );
}
