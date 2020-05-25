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
    return devices.load(this.data.deviceId);
  }

  recording(_, { recordings }) {
    return recordings.load(this.data.id);
  }
}