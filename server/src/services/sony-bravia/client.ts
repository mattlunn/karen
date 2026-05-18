export type PowerStatus = 'active' | 'standby';

export interface VolumeInformation {
  volume: number;
  mute: boolean;
}

export interface PlayingContentInfo {
  uri: string;
  title?: string;
  source?: string;
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

      // 7 = "Illegal State" — returned when the TV is in standby and the
      // requested method is not available. Surface as a typed error so
      // callers can decide whether it's a hard failure.
      throw new BraviaError(code, message, path, method);
    }

    if (!envelope.result || envelope.result.length === 0) {
      throw new Error(`Bravia ${path}.${method} returned empty result`);
    }

    return envelope.result[0];
  }

  async getPowerStatus(): Promise<PowerStatus> {
    const result = await this.#call<{ status: PowerStatus }>('/sony/system', 'getPowerStatus');
    return result.status;
  }

  async setPowerStatus(on: boolean): Promise<void> {
    await this.#call('/sony/system', 'setPowerStatus', [{ status: on }]);
  }

  async getVolumeInformation(): Promise<VolumeInformation> {
    const result = await this.#call<Array<{ target: string; volume: number; mute: boolean }>>(
      '/sony/audio',
      'getVolumeInformation'
    );

    const speaker = result.find(t => t.target === 'speaker') ?? result[0];

    if (!speaker) {
      throw new Error('Bravia getVolumeInformation: no targets returned');
    }

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

  async getPlayingContentInfo(): Promise<PlayingContentInfo | null> {
    try {
      return await this.#call<PlayingContentInfo>('/sony/avContent', 'getPlayingContentInfo');
    } catch (err) {
      // Illegal State is returned for example when the TV is on the Google
      // TV home screen with no app foregrounded — that's not an error, it's
      // "nothing is playing".
      if (err instanceof BraviaError && err.code === 7) {
        return null;
      }

      throw err;
    }
  }

  async setPlayContent(uri: string): Promise<void> {
    await this.#call('/sony/avContent', 'setPlayContent', [{ uri }]);
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

