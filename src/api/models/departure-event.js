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

  user(_, { usersById }) {
    return usersById.load(this.data.userId);
  }
}