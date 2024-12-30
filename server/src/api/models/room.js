export default class Room {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  displayWeight() {
    return this.data.displayWeight;
  }

  displayIconName() {
    return this.data.displayIconName;
  }

  name() {
    return this.data.name;
  }

  async devices(_, { devices }) {
    return devices.findByRoomId(this.data.id);
  }
}