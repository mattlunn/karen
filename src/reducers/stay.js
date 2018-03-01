import { LOADED_RESOURCE } from './resources';
import { STATUS } from '../constants/resources';
import { createSelector } from 'reselect';

export const CHANGED_STAY_STATUS = 'CHANGED_STAY_STATUS';

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
    case CHANGED_STAY_STATUS:
      return {
        ...state,
        ...action.data
      };
    default:
      return state;
  }
};

export function getStays({ stays }) {
  return stays;
}