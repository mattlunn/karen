export default class Heating {
  constructor(context) {
    this.context = context;
  }

  thermostats() {
    return this.context.thermostats.load(this.context);
  }
}