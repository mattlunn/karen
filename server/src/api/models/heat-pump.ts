import { Device } from '../../models';
import { HeatPumpMode } from '../../models/capabilities';

export default class HeatPump {
  #data: Device;

  __typename = 'HeatPump';

  constructor(data: Device) {
    this.#data = data;
  }

  compressorModulation(): Promise<number> {
    return this.#data.getHeatPumpCapability().getCompressorModulation();
  }

  dailyConsumedEnergy(): Promise<number> {
    return this.#data.getHeatPumpCapability().getDailyConsumedEnergy();
  }

  dhwTemperature(): Promise<number> {
    return this.#data.getHeatPumpCapability().getDHWTemperature();
  }

  heatingCoP(): Promise<number> {
    return this.#data.getHeatPumpCapability().getHeatingCoP();
  }

  async mode(): Promise<string> {
    return HeatPumpMode[await this.#data.getHeatPumpCapability().getMode()];
  }
}