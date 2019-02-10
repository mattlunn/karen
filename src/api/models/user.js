export default class User {
  constructor(user, context) {
    this.context = context;
    this.user = user;

    ['handle', 'id', 'avatar'].forEach((key) => {
      this[key] = this.user[key];
    });
  }

  async status() {
    const [upcoming, currentOrLast] = await Promise.all([
      this.context.upcomingStayByUserId.load(this.id, this.context),
      this.context.currentOrLastStayByUserId.load(this.id, this.context)
    ]);

    if (upcoming || currentOrLast.departure) {
      return "AWAY";
    } else {
      return "HOME";
    }
  }

  async since() {
    const [upcoming, currentOrLast] = await Promise.all([
      this.context.upcomingStayByUserId.load(this.id, this.context),
      this.context.currentOrLastStayByUserId.load(this.id, this.context)
    ]);

    if (upcoming || currentOrLast.departure) {
      return +currentOrLast.departure;
    } else {
      return +currentOrLast.arrival;
    }
  }

  async until() {
    const [upcoming, currentOrLast] = await Promise.all([
      this.context.upcomingStayByUserId.load(this.id, this.context),
      this.context.currentOrLastStayByUserId.load(this.id, this.context)
    ]);

    if (upcoming || currentOrLast.departure) {
      return upcoming ? +upcoming.eta : null;
    } else {
      return null;
    }
  }
}