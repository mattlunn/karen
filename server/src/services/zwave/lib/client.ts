import ws from 'ws';
import logger from '../../../logger';
import { v4 as uuid } from 'uuid';
import { EventEmitter } from 'events';

type ZWaveClientOptions = {
  user: string;
  password: string;
  host: string;
};

export default class ZWaveClient {
  #options: ZWaveClientOptions;
  #socket: ws | null;
  #events = new EventEmitter();
  #msgs = new Map();
  #nodes = new Map();

  constructor(options: ZWaveClientOptions) {
    this.#options = options;
  }

  #failAllInflightRequests(e: Error) {
    for (const [id, { reject }] of this.#msgs.entries()) {
      this.#msgs.delete(id);
      reject(e);
    }
  }

  getNodes = () => {
    return Array.from(this.#nodes.values());
  }

  connect = async () => {
    return new Promise<void>((res, rej) => {
      this.#socket = new ws(`wss://${this.#options.user}:${this.#options.password}@${this.#options.host}`);

      this.#socket.on('error', (e) => {
        this.#failAllInflightRequests(e);
        this.#events.emit('disconnected', e);
        rej(e);
      });
    
      this.#socket.on('close', (number) => {
        const error = new Error(`Socket was closed (${number})`);

        this.#failAllInflightRequests(error);
        this.#events.emit('disconnected', error);
        rej(error);
      });

      this.#socket.on('message', (data) => {
        const dataAsString = data.toString();
        const message = JSON.parse(dataAsString);
    
        switch (message.type) {
          case 'result': {
            const { success, messageId, result } = message;
            const promise = this.#msgs.get(messageId);
    
            if (typeof promise !== 'undefined') {
              this.#msgs.delete(messageId);
              return promise[success ? 'resolve' : 'reject'](result);
            }
            
            break;
          }
    
          case 'event': {
            if (message.event.source === 'node' && message.event.event === 'ready') {
              this.#nodes.set(message.event.nodeState.nodeId, message.event.nodeState);
            }
    
            if (message.event.source === 'controller' && message.event.event === 'node removed') {
              this.#nodes.delete(message.event.nodeState.nodeId);
            }

            this.#events.emit('event', message.event);
            break;
          }
          
          default: {
            logger.error(`Did not understand the following message from zwave-js-server`);
            logger.error(JSON.stringify(message));
          }
        }
      });

      this.#socket.on('open', async () => {
        try {
          await this.makeRequest('set_api_schema', { schemaVersion: 20 });
          
          const initialState: any = await this.makeRequest('start_listening');
      
          for (const node of initialState.state.nodes) {
            this.#nodes.set(node.nodeId, node);
          }

          res();
        } catch (e) {
          rej(e);
        }
      });
    });
  }

  makeRequest = async (command: string | object, data = {}) => {
    const id = uuid();
    const msg: Record<string, unknown> = typeof command === 'object' 
      ? { ...command }
      : { command, ...data };

    msg.messageId = id;

    return new Promise((resolve, reject) => {
      this.#msgs.set(id, { resolve, reject });

      if (this.#socket === null) {
        throw new Error('ZWaveClient is not connected; call connect() first');
      }

      this.#socket.send(JSON.stringify(msg));
    });
  }

  on = (event: string, listener: (...args: any[]) => void) => {
    this.#events.on(event, listener);
  }
}