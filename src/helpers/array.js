export function joinWithAnd(ar) {
  if (ar.length === 1) {
    return ar[0];
  }

  return `${ar.slice(0, -1).join(', ')} and ${ar[ar.length - 1]}`;
}

export function pluralise(ar) {
  return ar.length === 1 ? '' : 's';
}