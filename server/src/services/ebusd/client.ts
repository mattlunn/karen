import { createConnection } from 'net';
import sleep from '../../helpers/sleep';

export const MODES = {
  UNKNOWN: 0,
  STANDBY: 1,
  HEATING: 2,
  DHW: 3,
  DEICING: 4,
  FROST_PROTECTION: 5
};

const STATUS_TO_MODE: Record<string, typeof MODES[keyof typeof MODES]> = {
  'Heating': MODES.HEATING,
  'Warm Water': MODES.DHW,
  'Standby': MODES.STANDBY,
  'Deicing active': MODES.DEICING,
  'Frost protection': MODES.FROST_PROTECTION,
};

function toNumber(value: string): number {
  const num = Number(value);

  if (!Number.isFinite(num)) {
    throw new Error(`Expected a number but got "${value}"`);
  }

  return num;
}

export default class EbusClient {
  #host: string;
  #port: number;

  constructor(host: string, port: number) {
    this.#host = host;
    this.#port = port;
  }

  #command(command: string): Promise<string> {
    return new Promise((res, rej) => {
      const socket = createConnection(this.#port, this.#host, () => {
        const data: string[] = [];

        socket.setTimeout(60000, () => {
          socket.end();
        });

        socket.setEncoding('utf-8');
        socket.on('data', (response: string) => {
          data.push(...response.split('\n'));

          if (data.at(-1) === '' && data.at(-2) === '') {
            socket.end();
            res(data[0]);
          }
        });

        socket.write(`${command}\n`);
      });

      socket.on('error', (err) => {
        rej(err);
      });
    });
  }

  async #write(circuit: string, key: string, value = ''): Promise<string> {
    const result = await this.#command(`write -c ${circuit} ${key} ${value}`);

    if (result !== value) {
      throw new Error(`Unable to write '${value}' to ${key}. Result was ${result}`);
    }

    return result;
  }

  async #read<T>(value: string, circuit?: string, field = '', formatter?: (raw: string) => T): Promise<T extends undefined ? string : T> {
    const maxAttempts = formatter ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.#command(`read${circuit ? ' -f -c ' + circuit : ''} ${value} ${field}`);

      try {
        return (formatter ? formatter(result) : result) as T extends undefined ? string : T;
      } catch {
        await sleep(1000);
      }
    }

    throw new Error(`ebusd returned invalid value for ${value}${circuit ? ` (circuit: ${circuit})` : ''}${field ? ` (field: ${field})` : ''}`);
  }

  async getOutsideTemperature(): Promise<number> {
    return this.#read('DisplayedOutsideTemp', 'ctlv3', '', toNumber);
  }

  async getActualFlowTemperature(): Promise<number> {
    return this.#read('FlowTemp', 'hmu', '', toNumber);
  }

  async getDesiredFlowTemperature(): Promise<number> {
    return this.#read('State01', 'hmu', 'temp1.0', toNumber);
  }

  async getReturnTemperature(): Promise<number> {
    return this.#read('ReturnTemp', 'hmu', '', toNumber);
  }

  async getHotWaterCylinderTemperature(): Promise<number> {
    return this.#read('HwcStorageTemp', 'ctlv3', '', toNumber);
  }

  async getSystemPressure(): Promise<number> {
    return this.#read('State07', 'hmu', 'DisplaySystemPressure', toNumber);
  }

  async getCompressorPower(): Promise<number> {
    return this.#read('State07', 'hmu', 'power', toNumber);
  }

  async getCompressorModulation(): Promise<number> {
    return this.#read('State00', 'hmu', 'S00_CompressorModulation', toNumber);
  }

  async getEnergyDaily(): Promise<number> {
    return this.#read('State07', 'hmu', 'energy', toNumber);
  }

  async getCurrentYield(): Promise<number> {
    return this.#read('CurrentYieldPower', 'hmu', '', toNumber);
  }

  async getCurrentPower(): Promise<number> {
    return this.#read('CurrentConsumedPower', 'hmu', '', toNumber);
  }

  async getMode(): Promise<typeof MODES[keyof typeof MODES]> {
    return this.#read('Statuscode', 'hmu', '', (v) => {
      const status = v.split(':')[0];

      if (!(status in STATUS_TO_MODE)) {
        throw new Error(`Unknown status "${v}"`);
      }

      return STATUS_TO_MODE[status];
    });
  }

  async getDHWIsOn(): Promise<boolean> {
    return this.#read('HwcOpMode', 'ctlv3', '', (v) => {
      if (v !== 'off' && v !== 'on') {
        throw new Error(`Expected "off" or "on" but got "${v}"`);
      }

      return v !== 'off';
    });
  }

  async getCopHc(): Promise<number> {
    return this.#read('CopHc', 'hmu', '', toNumber);
  }

  async getCopHwc(): Promise<number> {
    return this.#read('CopHwc', 'hmu', '', toNumber);
  }

  async setIsDHWOn(isOn: boolean) {
    await this.#write('ctlv3', 'HwcOpMode', isOn ? 'manual' : 'off');
  }
}
