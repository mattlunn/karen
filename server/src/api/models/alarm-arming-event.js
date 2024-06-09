export default class AlarmArmingEvent {
  constructor(data, isEnd) {
    this.data = data;
    this.isEnd = isEnd;
  }

  id() {
    return `${this.data.id}|${Number(!!this.isEnd)}`;
  }

  timestamp() {
    return this.isEnd ? +this.data.end : +this.data.start;
  }

  mode() {
    return this.isEnd ? 'OFF' : this.data.mode;
  }
}