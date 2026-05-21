export type PowerStatus = 'active' | 'standby';

export interface VolumeInformation {
  volume: number;
  mute: boolean;
}

interface SonyVolumeTarget {
  target: string;
  volume: number;
  mute: boolean;
}

export interface SystemInformation {
  model: string;
  name?: string;
  product?: string;
  serial?: string;
}

interface SonyEnvelope<T> {
  result?: T[];
  error?: [number, string];
  id: number;
}

const IRCC_CODES: Record<string, string> = {
  Num0: 'AAAAAQAAAAEAAAAJAw==',
  Num1: 'AAAAAQAAAAEAAAAAAw==',
  Num2: 'AAAAAQAAAAEAAAABAw==',
  Num3: 'AAAAAQAAAAEAAAACAw==',
  Num4: 'AAAAAQAAAAEAAAADAw==',
  Num5: 'AAAAAQAAAAEAAAAEAw==',
  Num6: 'AAAAAQAAAAEAAAAFAw==',
  Num7: 'AAAAAQAAAAEAAAAGAw==',
  Num8: 'AAAAAQAAAAEAAAAHAw==',
  Num9: 'AAAAAQAAAAEAAAAIAw==',
  Return: 'AAAAAgAAAJcAAAAjAw==',
  ChannelUp: 'AAAAAQAAAAEAAAAQAw==',
  ChannelDown: 'AAAAAQAAAAEAAAARAw==',
  GGuide: 'AAAAAQAAAAEAAAAOAw==',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default class BraviaClient {
  #host: string;
  #psk: string;
  #timeoutMs: number;

  constructor(host: string, psk: string, timeoutMs: number) {
    this.#host = host;
    this.#psk = psk;
    this.#timeoutMs = timeoutMs;
  }

  async #call<T>(path: string, method: string, params: object[] = []): Promise<T> {
    const url = `http://${this.#host}${path}`;
    const body = JSON.stringify({ method, params, id: 1, version: '1.0' });

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-PSK': this.#psk,
      },
      body,
      signal: AbortSignal.timeout(this.#timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Bravia ${path}.${method} HTTP ${res.status}`);
    }

    const envelope = await res.json() as SonyEnvelope<T>;

    if (envelope.error) {
      const [code, message] = envelope.error;
      throw new BraviaError(code, message, path, method);
    }

    if (!envelope.result || envelope.result.length === 0) {
      throw new Error(`Bravia ${path}.${method} returned empty result`);
    }

    return envelope.result[0];
  }

  // For methods that return {"result":[]} on success (no payload).
  async #callVoid(path: string, method: string, params: object[] = []): Promise<void> {
    const url = `http://${this.#host}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-PSK': this.#psk,
      },
      body: JSON.stringify({ method, params, id: 1, version: '1.0' }),
      signal: AbortSignal.timeout(this.#timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Bravia ${path}.${method} HTTP ${res.status}`);
    }

    const envelope = await res.json() as SonyEnvelope<never>;

    if (envelope.error) {
      const [code, message] = envelope.error;
      throw new BraviaError(code, message, path, method);
    }
  }

  async getPowerStatus(): Promise<PowerStatus> {
    try {
      const result = await this.#call<{ status: PowerStatus }>('/sony/system', 'getPowerStatus');
      return result.status;
    } catch (err) {
      // code 7 = "Illegal State": API unavailable while TV is in standby.
      if (err instanceof BraviaError && err.code === 7) {
        return 'standby';
      }
      throw err;
    }
  }

  async setPowerStatus(on: boolean): Promise<void> {
    await this.#call('/sony/system', 'setPowerStatus', [{ status: on }]);
  }

  async getVolumeInformation(): Promise<VolumeInformation> {
    const result = await this.#call<SonyVolumeTarget[]>('/sony/audio', 'getVolumeInformation');
    const speaker = result.find(t => t.target === 'speaker') ?? result[0];

    return { volume: speaker.volume, mute: speaker.mute };
  }

  async setVolume(level: number): Promise<void> {
    await this.#call('/sony/audio', 'setAudioVolume', [
      { target: 'speaker', volume: String(level) },
    ]);
  }

  async setMute(mute: boolean): Promise<void> {
    await this.#call('/sony/audio', 'setAudioMute', [{ status: mute }]);
  }

  async setActiveApp(uri: string): Promise<void> {
    await this.#callVoid('/sony/appControl', 'setActiveApp', [{ uri }]);
  }

  async sendIrcc(name: keyof typeof IRCC_CODES): Promise<void> {
    const code = IRCC_CODES[name];
    const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${code}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;

    const res = await fetch(`http://${this.#host}/sony/ircc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=UTF-8',
        'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
        'X-Auth-PSK': this.#psk,
      },
      body,
      signal: AbortSignal.timeout(this.#timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`Bravia IRCC ${name} HTTP ${res.status}`);
    }
  }

  async switchToChannel(number: number): Promise<void> {
    const digits = String(number).split('');
    await this.sendIrcc('Return');
    for (const digit of digits) {
      await delay(600);
      await this.sendIrcc(`Num${digit}` as keyof typeof IRCC_CODES);
    }
  }

  async getSystemInformation(): Promise<SystemInformation> {
    return await this.#call<SystemInformation>('/sony/system', 'getSystemInformation');
  }
}

export class BraviaError extends Error {
  public code: number;
  public path: string;
  public method: string;

  constructor(code: number, message: string, path: string, method: string) {
    super(`Bravia ${path}.${method} error ${code}: ${message}`);
    this.code = code;
    this.path = path;
    this.method = method;
  }
}
