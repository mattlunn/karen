export default class Security {
  constructor(context) {
    this.context = context;
  }

  lights() {
    return this.context.lights.load(this.context);
  }
}