import { SHOW_MODAL, HIDE_MODAL } from '../reducers/modal';

export function showModal(name, props) {
  return {
    type: SHOW_MODAL,
    name,
    props
  };
}

export function hideModal(name) {
  return {
    type: HIDE_MODAL,
    name
  };
}