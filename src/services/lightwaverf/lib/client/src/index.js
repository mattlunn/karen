import WebSocket from 'ws';
import uuidv4 from 'uuid/v4';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

import LightwaveRfError, {
  INVALID_JSON,
  UNSUCCESSFUL_HTTP_RESPONSE,
  UNSUCCESSFUL_REQUEST,
  UNABLE_TO_SEND_REQUEST,
  CANNOT_RECONNECT_IN_CURRENT_STATE,
  CANNOT_SEND_REQUEST_IN_CURRENT_STATE,
  TIMED_OUT_WAITING_FOR_RESPONSE,
} from './error';

class LightwaveRfApi extends EventEmitter {
  constructor(authenticationToken, options = {}) {
    super();

    this._requests = new Map();
    this._sessionId = uuidv4();
    this._transactionId = 1000;
    this._authenticationToken = authenticationToken;
    this._options = Object.assign({
      timeout: 60000,
      websocketEndpoint: 'wss://v1-linkplus-app.lightwaverf.com/',
    }, options);
  }

  async reconnect() {
    const events = ['open', 'error', 'close', 'message'];

    if (typeof this._socket === 'object' && this._socket !== null) {
      if ([WebSocket.CONNECTING, WebSocket.OPEN].includes(this._socket.readyState)) {
        throw new LightwaveRfError(CANNOT_RECONNECT_IN_CURRENT_STATE, this._socket.readyState);
      }

      events.forEach((event) => {
        this._socket.removeAllListeners(event);
      });
    }

    this._socket = new WebSocket(this._options.websocketEndpoint);

    events.forEach((event) => {
      this._socket.on(event, this.emit.bind(this, event));
    });

    this._socket.on('message', (msg) => {
      let json;

      try {
        json = JSON.parse(msg);
      } catch (e) {
        // Intentionally empty
      }

      if (typeof json === 'object' && json !== null) {
        const data = json.items[0];
        const handlers = this._requests.get(data.itemId);

        if (handlers) {
          clearTimeout(handlers.timeout);

          this._requests.delete(data.itemId);

          if (data.success === true) {
            handlers.res(data.payload);
          } else {
            handlers.rej(new LightwaveRfError(UNSUCCESSFUL_REQUEST, null, data.payload));
          }
        }
      }
    });

    return new Promise((res, rej) => {
      this._socket.once('open', () => {
        this.request('user', 'authenticate', {
          token: this._authenticationToken,
        }).then(res, rej);
      });
    });
  }

  request(type, operation, payload = {}) {
    return new Promise((res, rej) => {
      const requestId = uuidv4();

      if (this._socket.readyState !== WebSocket.OPEN) {
        throw new LightwaveRfError(CANNOT_SEND_REQUEST_IN_CURRENT_STATE, this._socket.readyState);
      } else {
        this._socket.send(JSON.stringify({
          class: type,
          version: 1,
          senderId: this._sessionId,
          direction: 'request',
          operation,
          transactionId: this._transactionId += 1,
          items: [{
            itemId: requestId,
            payload,
          }],
        }), (err) => {
          if (err) {
            rej(new LightwaveRfError(UNABLE_TO_SEND_REQUEST, null, err));
          } else {
            this._requests.set(requestId, {
              res,
              rej,
              timeout: setTimeout(() => {
                this._requests.delete(requestId);
                rej(new LightwaveRfError(TIMED_OUT_WAITING_FOR_RESPONSE));
              }, this._options.timeout),
            });
          }
        });
      }
    });
  }
}

export async function getAuthenticationToken(email, password, options = {}) {
  const settings = Object.assign({
    authenticationEndpoint: 'https://auth.lightwaverf.com/v2/lightwaverf/autouserlogin/lwapps',
    applicationId: 'ios-01',
  }, options);

  const response = await fetch(settings.authenticationEndpoint, {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
    }),
    headers: {
      'x-lwrf-appid': settings.applicationId,
      'content-type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new LightwaveRfError(UNSUCCESSFUL_HTTP_RESPONSE, `Received a ${response.status} response`);
  }

  let json;

  try {
    json = await response.json();
  } catch (e) {
    throw new LightwaveRfError(INVALID_JSON, 'Invalid JSON', e);
  }

  return json.tokens.access_token;
}

export default async function (email, password, options = {}) {
  const authenticationToken = await getAuthenticationToken(email, password, options);
  const client = new LightwaveRfApi(authenticationToken, options);

  await client.reconnect();

  return client;
}
