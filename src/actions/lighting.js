import { applicationFetch } from '../helpers/fetch';
import { getAuthToken } from '../reducers/user';

export const UPDATE_LIGHT_SWITCH_STATUS = 'UPDATE_LIGHT_SWITCH_STATUS';

export function setLightSwitchStatus(switchId, type, isOn) {
  return (dispatch, getState) => {
    applicationFetch('/api/light', getAuthToken(getState().user), {
      featureId: switchId,
      value: isOn ? 1 : 0,
      type
    }).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error('HTTP status ' + res.status));
      }

      return res.json();
    }).then((data) => {
      dispatch({ type: UPDATE_LIGHT_SWITCH_STATUS, data });
    });
  };
}