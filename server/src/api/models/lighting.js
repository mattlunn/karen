export default class Lighting {
  async lights(_, { devices }) {
    return devices.findByType('light');
  }
}