export default class ArrivalEvent {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  timestamp() {
    return +this.data.arrival;
  }

  user(_, { users }) {
    return users.load(this.data.userId);
  }
}