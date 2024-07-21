export default class Light {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  async isOn() {
    return await this.data.getProperty('on') ?? false;
  }

  brightness() {
    return this.data.getProperty('brightness');
  }

  name() {
    return this.data.name;
  }

  async status() {
    return await this.data.getProperty('connected') ? 'OK' : 'OFFLINE';
  }
}