export default class BasicDevice {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  name() {
    return this.data.name;
  }

  async status() {
    return await this.data.getProperty('connected') ? 'OK' : 'OFFLINE';
  }
}