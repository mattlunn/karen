import { LOADED_RESOURCE } from './resources';
import { STATUS } from '../constants/resources';

export const UPDATE_ETA = 'UPDATE_ETA';

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
    case UPDATE_ETA:
      return {
        ...state,

        stays: state.stays.map((curr) => {
          if (curr.handle === action.data.handle) {
            return action.data;
          } else {
            return curr;
          }
        })
      };
    default:
      return state;
  }
};

export function getStays({ stays }) {
  return stays;
}