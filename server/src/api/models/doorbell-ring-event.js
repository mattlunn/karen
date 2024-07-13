export default class DoorbellRingEvent {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  timestamp() {
    return +this.data.start;
  }

  device(_, { devicesById }) {
    return devicesById.load(+this.data.deviceId);
  }
}