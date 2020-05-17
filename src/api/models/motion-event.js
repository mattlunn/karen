export default class MotionEvent {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  timestamp() {
    return +this.data.start;
  }

  async device(_, { devices }) {
    const device = await devices.load(this.data.deviceId);

    if (!device) {
      debugger;
    }

    return device;
  }

  recording(_, { recordings }) {
    return recordings.load(this.data.id);
  }
}