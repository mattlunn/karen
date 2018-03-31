import { LOADED_RESOURCE } from './resources';
import { HEATING } from '../constants/resources';
import { UPDATE_TARGET_TEMPERATURE } from '../actions/heating';

export default function (state = {}, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === HEATING) {
        return {
          ...action.data,

          history: action.data.history.map((data) => ({
            start: new Date(data.start),
            end: new Date(data.end)
          }))
        };
      } else {
        return state;
      }
    case UPDATE_TARGET_TEMPERATURE:
      return {
        ...state,
        target: action.data
      };
    default:
      return state;
  }
};

export function getHumidity({ humidity }) {
  return humidity;
}

export function getTargetTemperature({ target }) {
  return target;
}

export function getCurrentTemperature({ current }) {
  return current;
}

export function getIsHeating({ heating }) {
  return heating;
}

export function getIsHome({ home }) {
  return home;
}

export function getEta({ eta }) {
  return eta;
}

export function getHistory({ history }) {
  return history || [];
}