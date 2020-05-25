export default class User {
  constructor(user) {
    this.user = user;

    this.avatar = this.user.avatar;
    this.id = this.user.handle;
  }

  async status(_, { upcomingStayByUserId, currentOrLastStayByUserId }) {
    const [upcoming, currentOrLast] = await Promise.all([
      upcomingStayByUserId.load(this.user.id),
      currentOrLastStayByUserId.load(this.user.id)
    ]);

    if (upcoming || currentOrLast.departure) {
      return "AWAY";
    } else {
      return "HOME";
    }
  }

  async since(_, { upcomingStayByUserId, currentOrLastStayByUserId }) {
    const [upcoming, currentOrLast] = await Promise.all([
      upcomingStayByUserId.load(this.user.id),
      currentOrLastStayByUserId.load(this.user.id)
    ]);

    if (upcoming || currentOrLast.departure) {
      return +currentOrLast.departure;
    } else {
      return +currentOrLast.arrival;
    }
  }

  async until(_, { upcomingStayByUserId, currentOrLastStayByUserId }) {
    const [upcoming, currentOrLast] = await Promise.all([
      upcomingStayByUserId.load(this.user.id),
      currentOrLastStayByUserId.load(this.user.id)
    ]);

    if (upcoming || currentOrLast.departure) {
      return upcoming ? +upcoming.eta : null;
    } else {
      return null;
    }
  }
}