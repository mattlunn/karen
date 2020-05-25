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

  user(_, { usersById }) {
    return usersById.load(this.data.userId);
  }
}