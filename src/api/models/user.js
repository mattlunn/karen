export default class User {
  constructor(user, context) {
    this.context = context;
    this.user = user;

    this.avatar = this.user.avatar;
    this.id = this.user.handle;

    this.context.userByHandle.prime(this.user.handle, this);
  }

  async status() {
    const [upcoming, currentOrLast] = await Promise.all([
      this.context.upcomingStayByUserId.load(this.user.id, this.context),
      this.context.currentOrLastStayByUserId.load(this.user.id, this.context)
    ]);

    if (upcoming || currentOrLast.departure) {
      return "AWAY";
    } else {
      return "HOME";
    }
  }

  async since() {
    const [upcoming, currentOrLast] = await Promise.all([
      this.context.upcomingStayByUserId.load(this.user.id, this.context),
      this.context.currentOrLastStayByUserId.load(this.user.id, this.context)
    ]);

    if (upcoming || currentOrLast.departure) {
      return +currentOrLast.departure;
    } else {
      return +currentOrLast.arrival;
    }
  }

  async until() {
    const [upcoming, currentOrLast] = await Promise.all([
      this.context.upcomingStayByUserId.load(this.user.id, this.context),
      this.context.currentOrLastStayByUserId.load(this.user.id, this.context)
    ]);

    if (upcoming || currentOrLast.departure) {
      return upcoming ? +upcoming.eta : null;
    } else {
      return null;
    }
  }
}