import DataLoader from 'dataloader';

export default class DataLoaderWithContext {
  constructor(factory, loader) {
    this.factory = factory;
    this.loader = new DataLoader(loader);
  }

  async load(id, context) {
    const result = await this.loader.load(id);

    return result === null ? result : this.factory(result, context);
  }

  async loadMany(ids, context) {
    const results = await this.loader.loadMany(ids);

    return results.map(result => this.factory(result, context));
  }

  prime(id, value) {
    this.loader.prime(id, value);
  }
}