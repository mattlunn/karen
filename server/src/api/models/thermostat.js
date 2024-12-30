export default class Thermostat {
  constructor(device) {
    this.device = device;
  }

  id() {
    return this.device.id;
  }

  name() {
    return this.device.name;
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

  power() {
    return this.device.getProperty('power');
  }

  async status() {
    return await this.device.getProperty('connected') ? 'OK' : 'OFFLINE';
  }

  room(_, { rooms }) {
    if (!this.device.roomId) {
      return null;
    }

    return rooms.findById(this.device.roomId);
  }
}