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

  async #apiRequest<T = void>(method: string, path: string, body?: object): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const cookieHeader = this.#buildCookieHeader();
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const res = await fetch(`https://${this.host}:${this.port}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    this.#parseCookies(res.headers.getSetCookie());

    if (res.status === 401) {
      throw Object.assign(new Error('Unauthorized'), { response: { status: 401 } });
    }

    const json = await res.json() as { meta?: { rc: string; msg?: string }; data?: T };
    if (json.meta?.rc === 'error') {
      throw new Error(json.meta.msg ?? 'UniFi API error');
    }
    return (json.data ?? []) as T;
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
