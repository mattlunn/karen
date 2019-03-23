export default class Lighting {
  constructor(context) {
    this.context = context;
  }

  lights() {
    return this.context.lights.load(this.context);
  }
}