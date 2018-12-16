export const INVALID_JSON = 'ERR_LWRF_INVALID_JSON';
export const UNSUCCESSFUL_HTTP_RESPONSE = 'ERR_LWRF_UNSUCCESSFUL_HTTP_RESPONSE';
export const UNABLE_TO_SEND_REQUEST = 'ERR_LWRF_UNABLE_TO_SEND_REQUEST';
export const UNSUCCESSFUL_REQUEST = 'ERR_LWRF_UNSUCCESSFUL_REQUEST';
export const TIMED_OUT_WAITING_FOR_RESPONSE = 'ERR_LWRF_TIMED_OUT_WAITING_FOR_RESPONSE';

export default class LightwaveRfError extends Error {
  constructor(code, description, error) {
    super(description);

    this.code = code;
    this.error = error;
  }
}
