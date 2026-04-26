export function joinWithAnd(ar: string[]): string {
  if (ar.length === 1) {
    return ar[0];
  }

  return `${ar.slice(0, -1).join(', ')} and ${ar[ar.length - 1]}`;
}

export function pluralise(ar: unknown[]): string {
  return ar.length === 1 ? '' : 's';
}

export async function asyncFilter<T>(arr: T[], predicate: (item: T) => Promise<boolean>): Promise<T[]> {
  const results = await Promise.all(arr.map(predicate));
  return arr.filter((_, i) => results[i]);
}

export async function asyncFilterAndMap<T, U>(arr: T[], predicate: (item: T) => Promise<boolean>, mapper: (item: T) => Promise<U> | U): Promise<U[]> {
  const filtered = await asyncFilter(arr, predicate);
  return Promise.all(filtered.map(mapper));
}
