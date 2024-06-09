export const SHOW_MODAL = 'SHOW_MODAL';
export const CLOSE_MODAL = 'CLOSE_MODAL';

export default function (state = {}, action) {
  switch (action.type) {
    case SHOW_MODAL:
      return { ...state, activeModal: action.name, props: action.props };
    case CLOSE_MODAL:
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