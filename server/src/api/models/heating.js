export default class Heating {
  thermostats(_, { thermostats }) {
    return thermostats.load();
  }
}