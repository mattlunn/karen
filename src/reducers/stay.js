import { LOADED_RESOURCE } from './resources';
import { STATUS } from '../constants/resources';
import { createSelector } from 'reselect';

export default function (state = {}, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === STATUS) {
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

export function getStatus({ status }) {
  return status;
}

export const getStatusSince = createSelector(({ since }) => since, x => x && new Date(x));
export const getStatusUntil = createSelector(({ until }) => until, x => x && new Date(x));