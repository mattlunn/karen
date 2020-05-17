export default class Device {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  name() {
    return this.data.name;
  }
}