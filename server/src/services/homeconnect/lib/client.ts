import logger from '../../../logger';
import { EventSource } from 'eventsource';

const API_BASE = 'https://api.home-connect.com/api';

export type Appliance = {
  connected: boolean;
  haId: string;
  name: string;
  type: string;
}

export type ProgramOption = { key: string; value: number | string; unit?: string };

type SseItem = { key: string; timestamp: number; value: unknown };
export type SseType = 'NOTIFY' | 'EVENT' | 'STATUS' | 'CONNECTED' | 'DISCONNECTED';
export type SseCallback = (msg: { haId: string; items: SseItem[] }, type: SseType) => void;

export default class ApiClient {
  #getToken: () => Promise<string>;

  constructor(getToken: () => Promise<string>) {
    this.#getToken = getToken;
  }

  async #request(path: string, options: RequestInit = {}): Promise<unknown> {
    const token = await this.#getToken();
    const req = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers as Record<string, string>
      }
    });

    if (req.status === 204) {
      return null;
    }

    const json = await req.json();

    if (req.ok) {
      return json.data;
    } else {
      throw new Error(`HomeConnect API ${req.status}: ${JSON.stringify(json)}`);
    }
  }

  async getAppliances(): Promise<Appliance[]> {
    const data = await this.#request('/homeappliances') as { homeappliances: Appliance[] };
    return data.homeappliances;
  }

  async stopActiveProgram(haId: string): Promise<void> {
    await this.#request(`/homeappliances/${haId}/programs/active`, { method: 'DELETE' });
  }

  async getSelectedProgram(haId: string): Promise<{ key: string; options: ProgramOption[] }> {
    const data = await this.#request(`/homeappliances/${haId}/programs/selected`) as { key: string; options?: ProgramOption[] };

    return { key: data.key, options: data.options ?? [] };
  }

  async startActiveProgram(haId: string, programKey: string, options: ProgramOption[]): Promise<void> {
    await this.#request(`/homeappliances/${haId}/programs/active`, {
      method: 'PUT',
      body: JSON.stringify({ data: { key: programKey, options } })
    });
  }

  subscribeToEvents(onMessage: SseCallback): void {
    const connect = async () => {
      try {
        const token = await this.#getToken();
        const es = new EventSource(`${API_BASE}/homeappliances/events`, {
          fetch: (url, init) => fetch(url, {
            ...init,
            headers: {
              ...init?.headers as Record<string, string>,
              Authorization: `Bearer ${token}`
            }
          })
        });

        const handleEvent = (type: SseType) => (message: MessageEvent) => {
          const data = JSON.parse(message.data);
          const items: SseItem[] = data.items ?? [];

          onMessage({ haId: data.haId, items }, type);
        };

        (['NOTIFY', 'EVENT', 'STATUS'] as const).forEach(type => {
          es.addEventListener(type, handleEvent(type));
        });

        es.addEventListener('CONNECTED', (message: MessageEvent) => {
          const data = JSON.parse(message.data);

          onMessage({ haId: data.haId, items: [] }, 'CONNECTED');
        });

        es.addEventListener('DISCONNECTED', (message: MessageEvent) => {
          const data = JSON.parse(message.data);

          onMessage({ haId: data.haId, items: [] }, 'DISCONNECTED');
        });

        es.onerror = (err) => {
          logger.warn({ err }, 'Home Connect SSE error; reconnecting in 30s');

          es.close();
          setTimeout(connect, 30_000);
        };

        logger.info('Home Connect SSE connected');
      } catch (err) {
        logger.warn({ err }, 'Home Connect SSE connect failed; retrying in 30s');
        
        setTimeout(connect, 30_000);
      }
    };

    connect();
  }
}
