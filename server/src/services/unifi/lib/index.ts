import https from 'https';
import { IncomingMessage } from 'http';

const TIMEOUT_MS = 5000;

export interface UnifiUser {
  _id: string;
  duration: number;
  first_seen: number;
  is_guest: boolean;
  is_wired: boolean;
  last_seen: number;
  mac: string;
  name: string;
  noted: boolean;
  oui: string;
  rx_bytes: number;
  rx_packets: number;
  site_id: string;
  tx_bytes: number;
  tx_packets: number;
  usergroup_id: string;
}

export interface UnifiDevice {
  _id: string;
  ap_mac: string;
  assoc_time: number;
  authorized: boolean;
  blocked: boolean;
  essid: string;
  first_seen: number;
  hostname: string;
  ip: string;
  is_guest: boolean;
  is_wired: boolean;
  last_seen: number;
  mac: string;
  name: string;
  network: string;
  oui: string;
  site_id: string;
  uptime: number;
}

export class UnifiClient {
  #cookies: Record<string, string> = {};
  #loginPromise: Promise<void> | null = null;

  constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly username: string,
    private readonly password: string,
    private readonly site: string = 'default',
  ) {}

  async login(): Promise<void> {
    if (!this.#loginPromise) {
      this.#loginPromise = (async () => {
        this.#cookies = {};
        await this.#apiRequest('POST', '/api/login', {
          username: this.username,
          password: this.password,
          rememberMe: true,
        });
      })().finally(() => {
        this.#loginPromise = null;
      });
    }
    return this.#loginPromise;
  }

  async getAllUsers(): Promise<UnifiUser[]> {
    return this.#withRetry(() =>
      this.#apiRequest<UnifiUser[]>('GET', `/api/s/${this.site}/stat/alluser?type=all&within=8760`),
    );
  }

  async getClientDevices(): Promise<UnifiDevice[]> {
    return this.#withRetry(() =>
      this.#apiRequest<UnifiDevice[]>('GET', `/api/s/${this.site}/stat/sta/`),
    );
  }

  async #withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 401) {
        await this.login();
        return fn();
      }
      throw e;
    }
  }

  #apiRequest<T = void>(method: string, path: string, body?: object): Promise<T> {
    const data = body ? JSON.stringify(body) : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const cookieHeader = this.#buildCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }
    if (data) {
      headers['Content-Length'] = Buffer.byteLength(data).toString();
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.host,
          port: this.port,
          path,
          method,
          rejectUnauthorized: true,
          timeout: TIMEOUT_MS,
          headers,
        },
        (res: IncomingMessage) => {
          this.#parseCookies(res.headers['set-cookie']);

          let responseBody = '';
          res.on('data', (chunk: string) => {
            responseBody += chunk;
          });
          res.on('end', () => {
            if (res.statusCode === 401) {
              const err = Object.assign(new Error('Unauthorized'), {
                response: { status: 401 },
              });
              reject(err);
              return;
            }
            if (!responseBody) {
              resolve([] as unknown as T);
              return;
            }
            try {
              const json = JSON.parse(responseBody) as { meta?: { rc: string; msg?: string }; data?: T };
              if (json.meta?.rc === 'error') {
                reject(new Error(json.meta.msg ?? 'UniFi API error'));
              } else {
                resolve((json.data ?? []) as T);
              }
            } catch {
              reject(new Error(`Failed to parse UniFi response: ${responseBody.slice(0, 200)}`));
            }
          });
        },
      );

      req.on('timeout', () => req.destroy(new Error('UniFi request timed out')));
      req.on('error', reject);
      if (data) {
        req.write(data);
      }
      req.end();
    });
  }

  #buildCookieHeader(): string {
    return Object.entries(this.#cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  #parseCookies(setCookieHeaders: string[] | undefined): void {
    for (const header of setCookieHeaders ?? []) {
      const [nameValue] = header.split(';');
      const eqIdx = nameValue.indexOf('=');
      if (eqIdx !== -1) {
        const name = nameValue.slice(0, eqIdx).trim();
        const value = nameValue.slice(eqIdx + 1).trim();
        this.#cookies[name] = value;
      }
    }
  }
}
