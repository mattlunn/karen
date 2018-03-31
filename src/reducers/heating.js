import { LOADED_RESOURCE } from './resources';
import { HEATING } from '../constants/resources';

export default function (state = {}, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === HEATING) {
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