export default class TimePeriod {
  constructor(data) {
    this.data = data;
  }

  start() {
    return +this.data.start;
  }

  end() {
    return +this.data.end;
  }
}