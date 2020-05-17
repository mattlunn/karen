export default class LightOffEvent {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id + '-off';
  }

  timestamp() {
    return +this.data.end;
  }

  device(_, { devices }) {
    return devices.load(this.data.deviceId);
  }
}