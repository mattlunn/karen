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

  device(_, { devices }) {
    return devices.findById(+this.data.deviceId);
  }

  recording(_, { recordingsByEventId }) {
    return recordingsByEventId.load(this.data.id);
  }
}