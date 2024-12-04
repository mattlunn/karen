import { createConnection } from 'net';
import moment from 'moment';
import logger from '../../logger';

export const MODES = {
  UNKNOWN: 0,
  STANDBY: 1,
  HEATING: 2,
  DHW: 3,
  DEICING: 4,
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
      default:
        logger.error(`ebusd Statuscode for hmu is unknown value of "${value}"`);

        return MODES.UNKNOWN;
    }
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