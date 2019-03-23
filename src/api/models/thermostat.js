import { Heating } from '../../models';
import { TimePeriod } from '.';

export default class Thermostat {
  constructor({ thermostat, homeDetails }) {
    this.thermostat = thermostat;
    this.homeDetails = homeDetails;
  }

  id() {
    return this.thermostat.id;
  }

  targetTemperature() {
    return this.thermostat.target;
  }

  currentTemperature() {
    return this.thermostat.current;
  }

  isHeating() {
    return this.thermostat.heating;
  }

  humidity() {
    return this.thermostat.humidity;
  }

  isHome() {
    return this.homeDetails.home;
  }

  eta() {
    return +this.homeDetails.eta;
  }

  async heatingHistory(args) {
    const entries = await Heating.getHeatingHistoryForThermostat(this.thermostat.id, args.start, args.end);

    return entries.map(entry => new TimePeriod(entry));
  }
}