import { applicationFetch } from '../helpers/fetch';
import { getAuthToken } from '../reducers/user';
import { CHANGED_STAY_STATUS } from '../reducers/stay';

export function changeStayStatus(status, until) {
  return (dispatch, getState) => {
    applicationFetch('/api/status', getAuthToken(getState().user), {
      status,
      until
    }).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error('HTTP status ' + res.status));
      }

      return res.json();
    }).then((data) => {
      dispatch({ type: CHANGED_STAY_STATUS, data });
    });
  };
}