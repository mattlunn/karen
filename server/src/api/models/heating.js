export default class Heating {
  centralHeatingMode(_, { centralHeatingMode }) {
    return centralHeatingMode();
  }

  dhwHeatingMode(_, { dhwHeatingMode }) {
    return dhwHeatingMode();
  }

  thermostats(_, { devices }) {
    return devices.findByType('thermostat');
  }
}