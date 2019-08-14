import { Event } from '../../models';
import { TimePeriod } from '.';

export default class Thermostat {
  constructor(device) {
    this.device = device;
  }

  id() {
    return this.device.id;
  }

  targetTemperature() {
    return this.device.getProperty('target');
  }

  currentTemperature() {
    return this.device.getProperty('temperature');
  }

  isHeating() {
    return this.device.getProperty('heating');
  }

  humidity() {
    return this.device.getProperty('humidity');
  }

  isHome() {
    return false;
  }

  eta() {
    return 0;
  }

  async heatingHistory(args) {
    const entries = await Event.getHeatingHistoryForThermostat(this.device.id, args.start, args.end);

    return entries.map(entry => new TimePeriod(entry));
  }
}