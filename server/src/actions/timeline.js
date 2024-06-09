import { applicationFetch } from '../helpers/fetch';
import { getTimestampOfOldestEvent, LOADED_MORE_EVENTS, LOADING_MORE_EVENTS } from '../reducers/timeline';

export function loadMoreTimelineEvents() {
  return (dispatch, getState) => {
    dispatch({ type: LOADING_MORE_EVENTS });

    applicationFetch(`/api/timeline?after=${getTimestampOfOldestEvent(getState())}`).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error('HTTP status ' + res.status));
      }

      return res.json();
    }).then((payload) => {
      dispatch({ type: LOADED_MORE_EVENTS, events: payload.events });
    });
  };
}