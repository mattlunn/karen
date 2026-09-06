import { request } from 'http';
import sleep from '../../helpers/sleep';

type PowerStatus = 'active' | 'standby';

export interface VolumeInformation {
  volume: number;
  mute: boolean;
}

interface SonyVolumeTarget {
  target: string;
  volume: number;
  mute: boolean;
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
  Power: 'AAAAAQAAAAEAAAAVAw==',
};

interface HttpResponse {
  status: number;
  body: string;
}

// node:http rather than fetch (undici): a Bravia is powered off most of the day,
// and undici re-surfaces the failed connect as a second, un-awaited socket error
// that escapes every try/catch and lands in New Relic against whichever
// background transaction is live. node:http has no connection pool and delivers
// a connect failure exactly once, on the request's 'error' event.
function httpPost(url: string, headers: Record<string, string>, body: string, timeoutMs: number): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = request(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      agent: false,
      timeout: timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];

      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }));
    });

    req.on('timeout', () => req.destroy(new Error(`Bravia request to ${url} timed out after ${timeoutMs}ms`)));
    req.on('error', reject);
    req.end(body);
  });
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

  async #request<T>(path: string, method: string, params: object[] = []): Promise<SonyEnvelope<T>> {
    const body = JSON.stringify({ method, params, id: 1, version: '1.0' });

    const res = await httpPost(`http://${this.#host}${path}`, {
      'Content-Type': 'application/json',
      'X-Auth-PSK': this.#psk,
    }, body, this.#timeoutMs);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Bravia ${path}.${method} HTTP ${res.status}`);
    }

    const envelope = JSON.parse(res.body) as SonyEnvelope<T>;

    if (envelope.error) {
      const [code, message] = envelope.error;
      throw new BraviaError(code, message, path, method);
    }

    return envelope;
  }

  async #call<T>(path: string, method: string, params: object[] = []): Promise<T> {
    const envelope = await this.#request<T>(path, method, params);

    if (!envelope.result || envelope.result.length === 0) {
      throw new Error(`Bravia ${path}.${method} returned empty result`);
    }

    return envelope.result[0];
  }

  // Sony's mutation endpoints (setPowerStatus, setAudioVolume, setAudioMute) reply
  // with an empty `result` array on success, so they can't go through #call's
  // non-empty-result check above.
  async #callVoid(path: string, method: string, params: object[] = []): Promise<void> {
    await this.#request(path, method, params);
  }

  async getIsOn(): Promise<boolean> {
    try {
      const result = await this.#call<{ status: PowerStatus }>('/sony/system', 'getPowerStatus');
      return result.status === 'active';
    } catch (err) {
      // code 7 = "Illegal State": the TV answered, so it's reachable and on
      // the network — just in standby. A timeout or connection failure
      // (EHOSTUNREACH, ECONNREFUSED, etc.) is a different situation: we
      // can't tell if it's off or merely unreachable, and either way we
      // can't control it via IRCC. Let those propagate so the caller can
      // reflect that as a connectivity problem rather than reporting a
      // confident (and, without WoL, unactionable) "off".
      if (err instanceof BraviaError && err.code === 7) {
        return false;
      }
      throw err;
    }
  }

  // IRCC Power is a physical-remote-style toggle, not an explicit on/off, so
  // we only send it when the current state doesn't already match.
  // (We use IRCC rather than REST setPowerStatus because Google TV rejects
  // setPowerStatus with error 7 "Illegal State" when waking from standby.)
  async setIsOn(on: boolean): Promise<void> {
    if (await this.getIsOn() === on) {
      return;
    }

    await this.#sendIrcc('Power');
  }

  // Wakes the TV if it's off and waits for it to be ready to accept further
  // IRCC input (e.g. before switching channel or opening the guide). The
  // power API reports "active" within a second or two of waking, but the
  // Android/Google TV shell takes noticeably longer to start accepting
  // remote key presses, hence the fixed buffer on top of the poll.
  async wakeAndWaitUntilReady(): Promise<void> {
    if (await this.getIsOn()) {
      return;
    }

    await this.setIsOn(true);

    const deadline = Date.now() + 15_000;
    while (Date.now() < deadline && !await this.getIsOn()) {
      await sleep(500);
    }

    await sleep(6_000);
  }

  async getVolumeInformation(): Promise<VolumeInformation> {
    const result = await this.#call<SonyVolumeTarget[]>('/sony/audio', 'getVolumeInformation');
    const speaker = result.find(t => t.target === 'speaker') ?? result[0];

    return { volume: speaker.volume, mute: speaker.mute };
  }

  async setVolume(level: number): Promise<void> {
    await this.#callVoid('/sony/audio', 'setAudioVolume', [
      { target: 'speaker', volume: String(level) },
    ]);
  }

  async setMute(mute: boolean): Promise<void> {
    await this.#callVoid('/sony/audio', 'setAudioMute', [{ status: mute }]);
  }

  async showTvGuide(): Promise<void> {
    await this.#sendIrcc('GGuide');
  }

  async #sendIrcc(name: keyof typeof IRCC_CODES): Promise<void> {
    const code = IRCC_CODES[name];
    const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:X_SendIRCC xmlns:u="urn:schemas-sony-com:service:IRCC:1"><IRCCCode>${code}</IRCCCode></u:X_SendIRCC></s:Body></s:Envelope>`;

    const res = await httpPost(`http://${this.#host}/sony/ircc`, {
      'Content-Type': 'text/xml; charset=UTF-8',
      'SOAPACTION': '"urn:schemas-sony-com:service:IRCC:1#X_SendIRCC"',
      'X-Auth-PSK': this.#psk,
    }, body, this.#timeoutMs);

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Bravia IRCC ${name} HTTP ${res.status}`);
    }
  }

  async switchToChannel(number: number): Promise<void> {
    const digits = String(number).split('');

    await this.#sendIrcc('Return');

    for (const digit of digits) {
      await sleep(600);
      await this.#sendIrcc(`Num${digit}` as keyof typeof IRCC_CODES);
    }
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
