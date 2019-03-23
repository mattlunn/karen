export default class DataLoaderWithContextAndNoIdParam {
  constructor(factory, loader) {
    this.factory = factory;
    this.loader = loader;
  }

  async load(context) {
    if (!this.resolver) {
      this.resolver = this.loader().then((value) => {
        const result = value === null ? null : this.factory(value, context);

        return result;
      });
    }

    return await this.resolver;
  }

  prime(value) {
    this.resolver = Promise.resolve(value);
  }
}