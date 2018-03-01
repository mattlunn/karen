export function* range(start, stop, increment) {
  if (increment === undefined) {
    increment = start < stop ? 1 : -1;
  }

  for (let i = start; i < stop; i += increment) {
    yield i;
  }
}