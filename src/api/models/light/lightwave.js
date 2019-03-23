export default class LightwaveRfLight {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.name;
  }

  isOn() {
    return this.data.switchIsOn;
  }

  name() {
    return this.data.name;
  }
}