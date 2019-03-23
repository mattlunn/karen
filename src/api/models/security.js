export default class Security {
  constructor(context) {
    this.context = context;
  }

  isHome() {
    return this.context.isHome.load(this.context);
  }

  cameras() {
    return this.context.cameras.load(this.context);
  }
}