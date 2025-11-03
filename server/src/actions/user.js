import { LOGGING_IN, LOGGED_IN, ERROR_LOGGING_IN } from '../reducers/user';
import { applicationFetch } from '../helpers/fetch';

export function attemptLogin(username, password) {
  return (dispatch) => {
    dispatch({ type: LOGGING_IN });

    applicationFetch('/authentication/login', {
      username,
      password
    }).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error('HTTP status ' + res.status));
      }

      return res.json();
    }).then(({ username }) => {
      dispatch({ type: LOGGED_IN, username });
    }).catch((err) => {
      dispatch({ type: ERROR_LOGGING_IN, error: err });
    });
  };
}