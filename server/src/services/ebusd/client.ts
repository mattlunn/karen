import { createConnection } from 'net';
import sleep from '../../helpers/sleep';

export type Weekday = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

const WEEKDAYS: readonly Weekday[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// HwcLegionellaDay's own enum uses 3-letter tokens, distinct from the full
// weekday names hwcTimer.<Day> is addressed by.
const LEGIONELLA_DAY_TOKENS: Record<Weekday, string> = {
  Sunday: 'Sun',
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
};

export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[date.getDay()];
}

export function legionellaDayToken(day: Weekday): string {
  return LEGIONELLA_DAY_TOKENS[day];
}

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

  // The full Statuscode string, unlike getMode() which collapses everything
  // after the colon - "Warm Water: Compressor active" and "Warm Water:
  // Compressor blocked" are otherwise indistinguishable.
  async getDetailedStatus(): Promise<string> {
    return this.#read({ value: 'Statuscode', circuit: 'hmu' }, (v) => v);
  }

  // Minutes remaining before the compressor is allowed to start another DHW
  // charge. A value in the tens of thousands indicates a corrupted read
  // rather than a real anti-cycle wait.
  async getCompressorBlockMinutes(): Promise<number> {
    return this.#read({ value: 'CompressorBlocktime', circuit: 'hmu' }, toNumber);
  }

  // 5 dash-separated fault slots, e.g. "-;-;-;-;-" when nothing is active.
  async getCurrentError(): Promise<string> {
    return this.#read({ value: 'currenterror', circuit: 'ctlv3' }, (v) => v);
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

  async setDHWOpMode(mode: 'off' | 'manual' | 'time controlled') {
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

  // The controller's own weekly pasteurising schedule - `off` disables it,
  // any weekday re-arms it for every future occurrence of that day until
  // changed again.
  async getDHWLegionellaDay(): Promise<string> {
    return this.#read({ value: 'HwcLegionellaDay', circuit: 'ctlv3' }, (v) => v);
  }

  async setDHWLegionellaDay(day: Weekday | 'off') {
    await this.#write('ctlv3', 'HwcLegionellaDay', day === 'off' ? 'off' : legionellaDayToken(day));
  }

  async setDHWLegionellaTime(hhMmSs: string) {
    await this.#write('ctlv3', 'HwcLegionellaTime', hhMmSs);
  }

  // The weekly HWC comfort timer's single Karen-managed slot for `day`: a
  // bare [from, to) time-of-day window with no temperature of its own -
  // HwcTempDesired supplies that.
  //
  // UNVERIFIED: the field name and argument layout are inferred from the
  // ebusd-configuration TypeSpec source (vaillant/15.ctlv2.tsp,
  // HwcTimer_<Day>'s wTimeSlotWithoutTemp: slotIndex, slotCount,
  // slotTimeFrame.from, slotTimeFrame.to, then a fixed 0xffff filler) rather
  // than confirmed against a live `find -f`, since the currently-loaded
  // ebusd config predates the fix that makes these fields decodable at all.
  // Confirm with `find -f -c ctlv3 hwcTimer.Monday` once the ebusd config is
  // updated, and correct the argument list below if it differs.
  async setDHWComfortSchedule(day: Weekday, from: string, to: string) {
    await this.#write('ctlv3', `hwcTimer.${day}`, `0;1;${from};${to};65535`);
  }

  async clearDHWComfortSchedule(day: Weekday) {
    await this.#write('ctlv3', `hwcTimer.${day}`, `0;0;00:00;00:00;65535`);
  }
}
