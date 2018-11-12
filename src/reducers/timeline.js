import { LOADED_RESOURCE } from './resources';
import { TIMELINE } from '../constants/resources';

export default function (state = { events: [] }, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === TIMELINE) {
        return {
          ...action.data
        };
      } else {
        return state;
      }
    default:
      return state;
  }
};

export function getEvents({ timeline: { events } }) {
  return events;
}