export default class DataLoaderWithNoIdParam {
  constructor(loader, factory) {
    this.factory = factory;
    this.loader = loader;
  }

  async load() {
    if (!this.resolver) {
      this.resolver = this.loader().then((value) => {
        const result = value === null ? null : this.factory(value);

        return result;
      });
    }

    return await this.resolver;
  }

  prime(value) {
    this.resolver = Promise.resolve(value);
  }
}