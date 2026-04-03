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

  async #read<T>(descriptor: { value: string, circuit: string, field?: string }, formatter: (raw: string) => T): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await this.#command(`read -f -c ${descriptor.circuit} ${descriptor.value} ${descriptor.field ?? ''}`);

      try {
        return formatter(result);
      } catch {
        await sleep(1000);
      }
    }

    throw new Error(`ebusd returned invalid value ("${result}")for ${descriptor.value} (circuit: ${descriptor.circuit})${descriptor.field ? ` (field: ${descriptor.field})` : ''}`);
  }

  async getOutsideTemperature(): Promise<number> {
    return this.#read({ value: 'DisplayedOutsideTemp', circuit: 'ctlv3' }, toNumber);
  }

  async getActualFlowTemperature(): Promise<number> {
    return this.#read({ value: 'FlowTemp', circuit: 'hmu' }, toNumber);
  }

  async getDesiredFlowTemperature(): Promise<number> {
    return this.#read({ value: 'State01', circuit: 'hmu', field: 'temp1.0' }, toNumber);
  }

  async getReturnTemperature(): Promise<number> {
    return this.#read({ value: 'ReturnTemp', circuit: 'hmu' }, toNumber);
  }

  async getHotWaterCylinderTemperature(): Promise<number> {
    return this.#read({ value: 'HwcStorageTemp', circuit: 'ctlv3' }, toNumber);
  }

  async getSystemPressure(): Promise<number> {
    return this.#read({ value: 'State07', circuit: 'hmu', field: 'DisplaySystemPressure' }, toNumber);
  }

  async getCompressorPower(): Promise<number> {
    return this.#read({ value: 'State07', circuit: 'hmu', field: 'power' }, toNumber);
  }

  async getCompressorModulation(): Promise<number> {
    return this.#read({ value: 'State00', circuit: 'hmu', field: 'S00_CompressorModulation' }, toNumber);
  }

  async getEnergyDaily(): Promise<number> {
    return this.#read({ value: 'State07', circuit: 'hmu', field: 'energy' }, toNumber);
  }

  async getCurrentYield(): Promise<number> {
    return this.#read({ value: 'CurrentYieldPower', circuit: 'hmu' }, toNumber);
  }

  async getCurrentPower(): Promise<number> {
    return this.#read({ value: 'CurrentConsumedPower', circuit: 'hmu' }, toNumber);
  }

  async getMode(): Promise<typeof MODES[keyof typeof MODES]> {
    return this.#read({ value: 'Statuscode', circuit: 'hmu' }, (v) => {
      switch (v.split(':')[0]) {
        case 'Heating': return MODES.HEATING;
        case 'Warm Water': return MODES.DHW;
        case 'Standby': return MODES.STANDBY;
        case 'Deicing active': return MODES.DEICING;
        case 'Frost protection': return MODES.FROST_PROTECTION;
        default: throw new Error(`Unknown status "${v}"`);
      }
    });
  }

  async getDHWIsOn(): Promise<boolean> {
    return this.#read({ value: 'HwcOpMode', circuit: 'ctlv3' }, (v) => {
      if (v !== 'off' && v !== 'manual') {
        throw new Error(`Expected "off" or "manual" but got "${v}"`);
      }

      return v !== 'off';
    });
  }

  async getCopHc(): Promise<number> {
    return this.#read({ value: 'CopHc', circuit: 'hmu' }, toNumber);
  }

  async getCopHwc(): Promise<number> {
    return this.#read({ value: 'CopHwc', circuit: 'hmu' }, toNumber);
  }

  async setIsDHWOn(isOn: boolean) {
    await this.#write('ctlv3', 'HwcOpMode', isOn ? 'manual' : 'off');
  }
}
