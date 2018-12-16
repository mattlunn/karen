import WebSocket from 'ws';
import uuidv4 from 'uuid/v4';
import fetch from 'node-fetch';
import { EventEmitter } from 'events';

import LightwaveRfError, {
  INVALID_JSON,
  UNSUCCESSFUL_HTTP_RESPONSE,
  UNSUCCESSFUL_REQUEST,
  UNABLE_TO_SEND_REQUEST,
} from './error';

export default class LightwaveRfApi extends EventEmitter {
  constructor(options = {}) {
    super();

    this._options = Object.assign({
      timeout: 1000,
      websocketEndpoint: 'wss://v1-linkplus-app.lightwaverf.com/',
      authenticationEndpoint: 'https://auth.lightwaverf.com/v2/lightwaverf/autouserlogin/lwapps',
      applicationId: 'ios-01',
    }, options);

    this._socket = new WebSocket(this._options.websocketEndpoint);
    this._transactionId = 1000;
    this._requests = new Map();

    ['open', 'error', 'close', 'message'].forEach((event) => {
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
          this._requests.delete(data.itemId);

          if (data.success === true) {
            handlers.res(data.payload);
          } else {
            handlers.rej(new LightwaveRfError(UNSUCCESSFUL_REQUEST, null, data.payload));
          }
        }
      }
    });
  }

  async authenticate(email, password) {
    const response = await fetch(this._options.authenticationEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        email,
        password,
      }),
      headers: {
        'x-lwrf-appid': this._options.applicationId,
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

    this._user = json.user;
    this._accessToken = json.tokens.access_token;
  }

  request(type, operation, payload = {}) {
    return new Promise((res, rej) => {
      const requestId = uuidv4();
      const sendWork = () => {
        this._socket.send(JSON.stringify({
          class: type,
          version: 1,
          senderId: this._user._id,
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
            this._requests.set(requestId, { res, rej });
          }
        });
      };

      if (this._socket.readyState === WebSocket.OPEN) {
        sendWork();
      } else {
        this._socket.once('open', sendWork);
      }
    });
  }
}
