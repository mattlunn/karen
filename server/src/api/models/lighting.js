export default class Lighting {
  async lights(_, { lights }) {
    return lights.load();
  }
}