export default class Lighting {
  constructor(context) {
    this.context = context;
  }

  async lights() {
    return this.context.lights.load(this.context);
  }
}