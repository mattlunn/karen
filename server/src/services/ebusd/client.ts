import { createConnection } from 'net';
import logger from '../../logger';

export const MODES = {
  UNKNOWN: 0,
  STANDBY: 1,
  HEATING: 2,
  DHW: 3,
  DEICING: 4,
  FROST_PROTECTION: 5
};

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
        let data: string[] = [];

        socket.setEncoding('utf-8');
        socket.on('data', (response: string) => {
          data.push(...response.split('\n'));

          if (data.at(-1) === '' && data.at(-2) === '') {
            res(data[0]);
          }
        });

        logger.debug(`${command}`);
        socket.write(`${command}\n`);
      });
    });
  }

  async #write(circuit: string, key: string, value: string = ''): Promise<string> {
    const result = await this.#command(`write -c ${circuit} ${key} ${value}`);

    if (result !== value) {
      throw new Error(`Unable to write '${value}' to ${key}. Result was ${result}`);
    }
    
    return result;
  }

  #read(value: string, circuit?: string, field: string = ''): Promise<string> {
    return this.#command(`read${circuit ? ' -f -c ' + circuit : ''} ${value} ${field}`);
  }

  async getOutsideTemperature(): Promise<number> {
    return Number(await this.#read('OutsideTemp'));
  }

  async getActualFlowTemperature(): Promise<number> {
    return Number(await this.#read('FlowTemp', 'hmu'));
  }

  async getDesiredFlowTemperature(): Promise<number> {
    return Number(await this.#read('State01', 'hmu', 'temp1.0'));
  }

  async getReturnTemperature(): Promise<number> {
    return Number(await this.#read('ReturnTemp', 'hmu'));
  }

  async getHotWaterCylinderTemperature(): Promise<number> {
    return Number(await this.#read('HwcStorageTemp', 'ctlv3'));
  }

  async getSystemPressure(): Promise<number> {
    return Number(await this.#read('State07', 'hmu', 'DisplaySystemPressure'));
  }

  async getCompressorPower(): Promise<number> {
    return Number(await this.#read('State07', 'hmu', 'power'));
  }

  async getCompressorModulation(): Promise<number> {
    return Number(await this.#read('State00', 'hmu', 'S00_CompressorModulation'));
  }

  async getEnergyDaily(): Promise<number> {
    return Number(await this.#read('State07', 'hmu', 'energy'));
  }

  async getCurrentYield(): Promise<number> {
    return Number(await this.#read('CurrentYieldPower', 'hmu'));
  }

  async getCurrentPower(): Promise<number> {
    return Number(await this.#read('CurrentConsumedPower', 'hmu'));
  }

  async getMode(): Promise<typeof MODES[keyof typeof MODES]> {
    const value = await this.#read('Statuscode', 'hmu');

    switch (value.split(':')[0]) {
      case 'Heating':
        return MODES.HEATING;
      case 'Warm Water':
        return MODES.DHW;
      case 'Standby':
        return MODES.STANDBY;
      case 'Deicing active':
        return MODES.DEICING;
      case 'Frost protection':
        return MODES.FROST_PROTECTION;
      default:
        logger.error(`ebusd Statuscode for hmu is unknown value of "${value}"`);

        return MODES.UNKNOWN;
    }
  }

  async getDHWIsOn(): Promise<boolean> {
    const mode = await this.#read('HwcOpMode', 'ctlv3');

    if (mode === 'off') {
      return false;
    }

    return true;
  }

  async getCopHc(): Promise<number> {
    return Number(await this.#read('CopHc', 'hmu'));
  }

  async getCopHwc(): Promise<number> {
    return Number(await this.#read('CopHwc', 'hmu'));
  }

  async setIsDHWOn(isOn: boolean) {
    await this.#write('ctlv3', 'HwcOpMode', isOn ? 'manual' : 'off');
  }
}