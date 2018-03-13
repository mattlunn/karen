import { SHOW_MODAL, CLOSE_MODAL } from '../reducers/modal';

export function showModal(name, props) {
  return {
    type: SHOW_MODAL,
    name,
    props
  };
}

export function closeModal(name) {
  return {
    type: CLOSE_MODAL,
    name
  };
}