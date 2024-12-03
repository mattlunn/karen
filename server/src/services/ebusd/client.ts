import { createConnection } from 'net';
import moment from 'moment';
import logger from '../../logger';

export default class EbusClient {
  #host: string;
  #port: number;

  constructor(host: string, port: number) {
    this.#host = host;
    this.#port = port;
  }

  #command<T>(command: string): Promise<T> {
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

        logger.debug(`${command}`);
        socket.write(`${command}\n`);
      });
    });
  }

  async #write<T>(circuit: string, key: string, value: string = ''): Promise<T> {
    const result = await this.#command<T>(`write -c ${circuit} ${key} ${value}`);

    if (result !== value) {
      throw new Error(`Unable to write '${value}' to ${key}. Result was ${result}`);
    }
    
    return result;
  }

  #read<T>(value: string, circuit?: string, field: string = ''): Promise<T> {
    return this.#command<T>(`read${circuit ? ' -f -c ' + circuit : ''} ${value} ${field}`);
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

    logger.info(`ebusd Statuscode for hmu is "${value}"`);

    return value !== 'Standby';
  }

  async enableDHWAwayMode() {
    return await Promise.all([
      this.#write('ctlv3', 'HwcHolidayStartDate', moment().format('DD.MM.YYYY')),
      this.#write('ctlv3', 'HwcHolidayStartTime', '00:00:00'),

      this.#write('ctlv3', 'HwcHolidayEndDate', moment().add('1', 'y').format('DD.MM.yyyy')),
      this.#write('ctlv3', 'HwcHolidayEndTime', '00:00:00')
    ]);
  }

  async disableDHWAwayMode() {
    return await Promise.all([
      this.#write('ctlv3', 'HwcHolidayStartDate', '01.01.2019'),
      this.#write('ctlv3', 'HwcHolidayStartTime', '00:00:00'),

      this.#write('ctlv3', 'HwcHolidayEndDate', '01.01.2019'),
      this.#write('ctlv3', 'HwcHolidayEndTime', '00:00:00')
    ]);
  }
}