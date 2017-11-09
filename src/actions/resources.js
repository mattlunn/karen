import { LOADING_RESOURCE, LOADED_RESOURCE, ERROR_LOADING_RESOURCE } from '../reducers/resources';
import { push } from 'react-router-redux';
import { getIsResourceLoading } from '../reducers/resources';
import { applicationFetch } from '../helpers/fetch';
import { getAuthToken } from '../reducers/user';

export function fetchResource(name) {
  return (dispatch, getState) => {
    if (getIsResourceLoading(getState().resources, name)) {
      return;
    }

    dispatch({
      type: LOADING_RESOURCE,
      name
    });

    applicationFetch('/api/' + name, getAuthToken(getState().user))
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            dispatch(push('/login'));
          }

          return Promise.reject(new Error('HTTP status ' + res.status));
        }

        return res.json();
      })
      .then((data) => dispatch({ type: LOADED_RESOURCE, name, data }))
      .catch(err => dispatch({ type: ERROR_LOADING_RESOURCE, name, error: err }));
  };
}