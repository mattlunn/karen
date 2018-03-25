import { LOADED_RESOURCE } from './resources';
import { SECURITY } from '../constants/resources';

export default function (state = { cameras: [], isHome: null }, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === SECURITY) {
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

export function getIsInHomeMode({ isInHomeMode }) {
  return isInHomeMode;
}

export function getCameras({ cameras }) {
  return cameras;
}