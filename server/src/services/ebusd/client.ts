import { createConnection } from 'net';
import logger from '../../logger';

export default class EbusClient {
  #host: string;
  #port: number;

  constructor(host: string, port: number) {
    this.#host = host;
    this.#port = port;
  }

  #read<T>(value: string, circuit?: string, field: string = ''): Promise<T> {
    return new Promise((res, rej) => {
      const socket = createConnection(this.#port, this.#host, () => {
        let data = [];

        socket.setEncoding('utf-8');
        socket.on('data', (response: string) => {
          data.push(...response.split('\n'));

          if (data.at(-1) === '' && data.at(-2) === '') {
            res(data.at(0) as T);
          }
        });

        socket.write(`read${circuit ? ' -c ' + circuit : ''} ${value} ${field}\n`);
      });
    });
  }

  async getOutsideTemperature(): Promise<number> {
    return Number(await this.#read<number>('OutsideTemp'));
  }

  async getActualFlowTemperature(): Promise<number> {
    return Number(await this.#read<number>('FlowTemp', 'hmu'));
  }

  async getDesiredFlowTemperature(): Promise<number> {
    return Number(await this.#read<number>('State01', 'hmu', 'temp1.0'));
  }

  async getReturnTemperature(): Promise<number> {
    return Number(await this.#read<number>('ReturnTemp', 'hmu'));
  }

  async getHotWaterCylinderTemperature(): Promise<number> {
    return Number(await this.#read<number>('HwcStorageTemp', 'ctlv3'));
  }

  async getSystemPressure(): Promise<number> {
    return Number(await this.#read<number>('State07', 'hmu', 'DisplaySystemPressure'));
  }

  async getCompressorPower(): Promise<number> {
    return Number(await this.#read<number>('State07', 'hmu', 'power'));
  }

  async getIsActive(): Promise<boolean> {
    const value = await this.#read<string>('Statuscode', 'hmu');

    logger.debug(`ebusd Statuscode for hmu is "${value}"`);

    return value !== 'Standby';
  }
}