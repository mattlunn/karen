export function joinWithAnd(ar) {
  if (ar.length === 1) {
    return ar[0].name;
  }

  return `${ar.slice(0, -1).map(({ name }) => name).join(', ')} and ${ar[ar.length - 1].name}`;
}

export function pluralise(ar) {
  return ar.length === 1 ? '' : 's';
}