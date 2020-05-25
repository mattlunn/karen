export default class LightOnEvent {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id + '-on';
  }

  timestamp() {
    return +this.data.start;
  }

  device(_, { devicesById }) {
    return devicesById.load(+this.data.deviceId);
  }
}