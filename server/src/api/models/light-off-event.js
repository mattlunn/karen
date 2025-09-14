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
    return devices.findById(+this.data.deviceId);
  }

  duration() {
    return (this.data.end - this.data.start) / 1000;
  }
}