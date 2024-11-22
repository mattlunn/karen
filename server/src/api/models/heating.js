export default class Heating {
  centralHeatingMode(_, { centralHeatingMode }) {
    return centralHeatingMode();
  }

  dhwHeatingMode(_, { dhwHeatingMode }) {
    return dhwHeatingMode();
  }

  thermostats(_, { thermostats }) {
    return thermostats.load();
  }
}