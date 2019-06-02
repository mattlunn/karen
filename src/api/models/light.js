export default class Light {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  isOn() {
    return this.data.getProperty('on');
  }

  name() {
    return this.data.name;
  }
}