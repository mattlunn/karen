import { applicationFetch } from '../helpers/fetch';
import { getAuthToken } from '../reducers/user';
import { closeModal } from './modal';
import { UPDATE_ETA } from '../reducers/stay';
import { ETA_PICKER } from '../constants/modals';

export function setEtaForUser(handle, eta) {
  return (dispatch, getState) => {
    applicationFetch('/api/eta', getAuthToken(getState().user), {
      handle,
      eta
    }).then((res) => {
      if (!res.ok) {
        return Promise.reject(new Error('HTTP status ' + res.status));
      }

      return res.json();
    }).then((data) => {
      dispatch({ type: UPDATE_ETA, data });
      dispatch(closeModal(ETA_PICKER))
    });
  };
}