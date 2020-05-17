export default class DepartureEvent {
  constructor(data) {
    this.data = data;
  }

  id() {
    return this.data.id;
  }

  timestamp() {
    return +this.data.departure;
  }

  user(_, { users }) {
    return users.load(this.data.userId);
  }
}