export default class Heating {
  dhwHeatingMode(_, { dhwHeatingMode }) {
    return dhwHeatingMode();
  }

  thermostats(_, { devices }) {
    return devices.findByType('thermostat');
  }
}