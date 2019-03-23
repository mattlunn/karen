export default class TpLinkLight {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  isOn() {
    return this.data.isOn;
  }

  name() {
    return this.data.name;
  }
}