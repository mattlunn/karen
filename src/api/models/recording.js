export default class Recording {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }
}