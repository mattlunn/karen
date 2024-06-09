export const LOGGING_IN = 'LOGGING_IN';
export const LOGGED_IN = 'LOGGED_IN';
export const LOGGED_OUT = 'LOGGED_OUT';
export const ERROR_LOGGING_IN = 'ERROR_LOGGING_IN';

export default function (state = { loggingIn: false }, action) {
  switch (action.type) {
    case LOGGING_IN:
      return {
        ...state,
        loggingIn: true
      };
    case LOGGED_IN:
      return {
        ...state,
        loggingIn: false,
        username: action.username,
      };
    case LOGGED_OUT:
      return {
        loggingIn: false
      };
    case ERROR_LOGGING_IN:
      return {
        loggingIn: false,
        error: action.error
      };
    default:
      return state;
  }
}

export function getIsLoggingIn({ loggingIn }) {
  return loggingIn;
}

export function getLoginError({ error = null }) {
  return error;
}

export function getUsername({ username }) {
  return username;
}