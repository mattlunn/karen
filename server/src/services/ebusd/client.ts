import { createConnection } from 'net';
import sleep from '../../helpers/sleep';

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

    // ebusd echoes the decoded value back for some messages and replies with the
    // literal `done` for writes that have no slave read-back. A numeric field
    // echoes back at its own precision (`70` -> `70.00`), so accept a numeric
    // match too. Anything else (`ERR: ...`) is a real failure.
    const numericValue = Number(value);
    const echoedSameNumber = value !== '' && Number.isFinite(numericValue) && Number(result) === numericValue;

    if (result !== value && result !== 'done' && !echoedSameNumber) {
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

    throw new Error(`ebusd returned invalid values for ${descriptor.value} (circuit: ${descriptor.circuit})${descriptor.field ? ` (field: ${descriptor.field})` : ''}`);
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

  async getMode(): Promise<string> {
    return this.#read({ value: 'Statuscode', circuit: 'hmu' }, (v) => v.split(':')[0]);
  }

  async getDHWIsOn(): Promise<boolean> {
    return this.#read({ value: 'HwcOpMode', circuit: 'ctlv3' }, (v) => {
      if (v !== 'off' && v !== 'manual' && v !== 'time controlled') {
        throw new Error(`Expected "off", "manual" or "time controlled" but got "${v}"`);
      }

      return v !== 'off';
    });
  }

  async getDHWIsBoosting(): Promise<boolean> {
    return this.#read({ value: 'HwcSFMode', circuit: 'ctlv3' }, (v) => v === 'load');
  }

  async getDHWMaxChargeTime(): Promise<number> {
    return this.#read({ value: 'HwcMaxChargeTime', circuit: 'ctlv3' }, toNumber);
  }

  async getDHWTargetTemp(): Promise<number> {
    return this.#read({ value: 'HwcTempDesired', circuit: 'ctlv3' }, toNumber);
  }

  async getCopHc(): Promise<number> {
    return this.#read({ value: 'CopHc', circuit: 'hmu' }, toNumber);
  }

  async getCopHwc(): Promise<number> {
    return this.#read({ value: 'CopHwc', circuit: 'hmu' }, toNumber);
  }

  async setDHWOpMode(mode: 'off' | 'manual') {
    await this.#write('ctlv3', 'HwcOpMode', mode);
  }

  async setDHWTargetTemp(celsius: number) {
    await this.#write('ctlv3', 'HwcTempDesired', String(celsius));
  }

  // Vaillant "Sonderfunktion": `load` is the physical panel's one-time hot-water
  // boost - it ignores the charge hysteresis, is bounded by HwcMaxChargeTime,
  // and the controller reverts HwcSFMode to `auto` itself once done.
  async setDHWSpecialFunction(mode: 'auto' | 'load') {
    await this.#write('ctlv3', 'HwcSFMode', mode);
  }
}
