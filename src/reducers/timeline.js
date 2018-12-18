import { LOADED_RESOURCE } from './resources';
import { TIMELINE } from '../constants/resources';

export const LOADED_MORE_EVENTS = 'LOAD_MORE_EVENTS';
export const LOADING_MORE_EVENTS = 'LOADING_MORE_EVENTS';

export default function (state = { events: [], isLoadingMoreEvents: false, hasMoreEvents: true }, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === TIMELINE) {
        return {
          ...state,
          ...action.data
        };
      } else {
        return state;
      }
    case LOADED_MORE_EVENTS:
      return {
        ...state,

        events: [...state.events, ...action.events],
        isLoadingMoreEvents: false,
        hasMoreEvents: !!action.events.length
      };
    case LOADING_MORE_EVENTS:
      return {
        ...state,

        isLoadingMoreEvents: true
      };
    default:
      return state;
  }
};

export function getEvents({ timeline: { events } }) {
  return events;
}

export function getTimestampOfOldestEvent({ timeline: { events } }) {
  return events[events.length - 1].timestamp;
}

export function getIsLoadingMoreEvents({ timeline: { isLoadingMoreEvents } }) {
  return isLoadingMoreEvents;
}

export function getHasMoreEvents({ timeline: { hasMoreEvents } }) {
  return hasMoreEvents;
}