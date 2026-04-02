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

function isNumeric(value: string): boolean {
  return Number.isFinite(Number(value));
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

  async #read(value: string, circuit?: string, field = '', validate?: (raw: string) => boolean): Promise<string> {
    const maxAttempts = validate ? 3 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.#command(`read${circuit ? ' -f -c ' + circuit : ''} ${value} ${field}`);

      if (!validate || validate(result)) {
        return result;
      } else {
        await sleep(1000);
      }
    }

    throw new Error(`ebusd returned invalid value for ${value}${circuit ? ` (circuit: ${circuit})` : ''}${field ? ` (field: ${field})` : ''}`);
  }

  async getOutsideTemperature(): Promise<number> {
    return Number(await this.#read('DisplayedOutsideTemp', 'ctlv3', '', isNumeric));
  }

  async getActualFlowTemperature(): Promise<number> {
    return Number(await this.#read('FlowTemp', 'hmu', '', isNumeric));
  }

  async getDesiredFlowTemperature(): Promise<number> {
    return Number(await this.#read('State01', 'hmu', 'temp1.0', isNumeric));
  }

  async getReturnTemperature(): Promise<number> {
    return Number(await this.#read('ReturnTemp', 'hmu', '', isNumeric));
  }

  async getHotWaterCylinderTemperature(): Promise<number> {
    return Number(await this.#read('HwcStorageTemp', 'ctlv3', '', isNumeric));
  }

  async getSystemPressure(): Promise<number> {
    return Number(await this.#read('State07', 'hmu', 'DisplaySystemPressure', isNumeric));
  }

  async getCompressorPower(): Promise<number> {
    return Number(await this.#read('State07', 'hmu', 'power', isNumeric));
  }

  async getCompressorModulation(): Promise<number> {
    return Number(await this.#read('State00', 'hmu', 'S00_CompressorModulation', isNumeric));
  }

  async getEnergyDaily(): Promise<number> {
    return Number(await this.#read('State07', 'hmu', 'energy', isNumeric));
  }

  async getCurrentYield(): Promise<number> {
    return Number(await this.#read('CurrentYieldPower', 'hmu', '', isNumeric));
  }

  async getCurrentPower(): Promise<number> {
    return Number(await this.#read('CurrentConsumedPower', 'hmu', '', isNumeric));
  }

  async getMode(): Promise<typeof MODES[keyof typeof MODES]> {
    const value = await this.#read('Statuscode', 'hmu', '', (v) => v.split(':')[0] in STATUS_TO_MODE);
    return STATUS_TO_MODE[value.split(':')[0]];
  }

  async getDHWIsOn(): Promise<boolean> {
    const mode = await this.#read('HwcOpMode', 'ctlv3', '', (v) => v === 'off' || v === 'on');
    return mode !== 'off';
  }

  async getCopHc(): Promise<number> {
    return Number(await this.#read('CopHc', 'hmu', '', isNumeric));
  }

  async getCopHwc(): Promise<number> {
    return Number(await this.#read('CopHwc', 'hmu', '', isNumeric));
  }

  async setIsDHWOn(isOn: boolean) {
    await this.#write('ctlv3', 'HwcOpMode', isOn ? 'manual' : 'off');
  }
}
