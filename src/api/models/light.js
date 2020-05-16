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

  brightness() {
    return this.data.getProperty('brightness');
  }

  name() {
    return this.data.name;
  }
}