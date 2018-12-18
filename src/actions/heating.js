import { applicationFetch } from '../helpers/fetch';

export const UPDATE_TARGET_TEMPERATURE = 'UPDATE_TARGET_TEMPERATURE';

export function setTargetTemperature(temperature) {
  return (dispatch) => {
    applicationFetch('/api/temperature', {
      target_temperature: temperature
    }).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error('HTTP status ' + res.status));
      }

      return res.json();
    }).then(() => {
      dispatch({ type: UPDATE_TARGET_TEMPERATURE, temperature });
    });
  };
}