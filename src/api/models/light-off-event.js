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

  device(_, { devicesById }) {
    return devicesById.load(+this.data.deviceId);
  }

  duration() {
    return this.data.end - this.data.start;
  }
}