import logger from "../../../logger";
import { EventEmitter } from 'events';
import EventSource from 'eventsource';

enum Events {
  PROGRAM_START = 'PROGRAM_START',
}

type ApiClientConfig = {
  access_token: string;
}

type OnProgramStartPayload = {
  deviceId: string;
}

type Appliance = {
  connected: Boolean;
  haId: string;
  name: 'Oven' | 'Dishwasher' | 'Microwave'
  type: 'Oven' | 'Dishwasher';
}

export default class ApiClient {
  #accessToken: string;
  #eventEmitter: EventEmitter;

  constructor(config: ApiClientConfig) {
    this.#accessToken = config.access_token
    this.#eventEmitter = new EventEmitter();
  }

  async #request(path: string) {
    const req = await fetch(`https://api.home-connect.com/api${path}`, {
      headers: {
        Authorization: `Bearer ${this.#accessToken}`
      }
    });

    const json = await req.json();

    if (req.ok) {
      return json.data;
    } else {
      throw new Error(`${req.status}: ${await req.text()}`);
    }
  }

  async getAppliances(): Promise<Appliance[]> {
    return (await this.#request('/homeappliances')).homeappliances;
  }

  subscribeToEvents() {
    const sse = new EventSource('https://api.home-connect.com/api/homeappliances/events', {
      headers: {
        Authorization: `Bearer ${this.#accessToken}`
      }
    });

    ['NOTIFY', 'EVENT', 'STATUS'].forEach((type) => {
      sse.addEventListener(type, (message) => {
        const data = JSON.parse(message.data);
  
        logger.info({
          type,
          data
        });
      });
    });

    sse.addEventListener('STATUS', (message) => {
      const data = JSON.parse(message.data);

      this.#eventEmitter.emit(Events.PROGRAM_START, {
        deviceId: data.haId
      });
    });

    sse.onmessage = logger.info;

    sse.onerror = logger.info;
  }

  onProgramStart(listener: (payload: OnProgramStartPayload) => void) {
    this.#eventEmitter.addListener(Events.PROGRAM_START, listener);
  }
}