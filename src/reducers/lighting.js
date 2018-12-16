import { LOADED_RESOURCE } from './resources';
import { LIGHTING } from '../constants/resources';
import { UPDATE_LIGHT_SWITCH_STATUS } from '../actions/lighting';

export default function (state = { lights: [] }, action) {
  switch (action.type) {
    case LOADED_RESOURCE:
      if (action.name === LIGHTING) {
        return {
          ...action.data
        };
      } else {
        return state;
      }
    case UPDATE_LIGHT_SWITCH_STATUS:
      return {
        ...state,
        ...action.data
      };
    default:
      return state;
  }
};

export function getLights({ lighting: { lights }}) {
  return lights;
}