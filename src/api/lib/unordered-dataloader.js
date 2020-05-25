import DataLoader from 'dataloader';

export default function UnorderedDataLoader(loader, selector, hydrator) {
  return new DataLoader(async (ids) => {
    const results = await loader(ids);
    const resultsMap = new Map(results.map(result => [selector(result), hydrator(result)]));

    return ids.map(id => resultsMap.get(id));
  });
}
