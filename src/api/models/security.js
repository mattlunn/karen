export default class Security {
  isHome(_, { isHome }) {
    return isHome.load();
  }

  cameras(_, { cameras }) {
    return cameras.load();
  }
}