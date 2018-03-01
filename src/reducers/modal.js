export const SHOW_MODAL = 'SHOW_MODAL';
export const HIDE_MODAL = 'HIDE_MODAL';

export default function (state = {}, action) {
  switch (action.type) {
    case SHOW_MODAL:
      return { ...state, activeModal: action.name, props: action.props };
    case HIDE_MODAL:
      return { ...state, activeModal: null, props: null };
    default:
      return state;
  }
}

export function getActiveModal(state) {
  return state.modal.activeModal;
}

export function getActiveModalProps(state) {
  return state.modal.props;
}