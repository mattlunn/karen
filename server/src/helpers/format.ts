/**
 * Formats a capability value for display, returning a dash when the value has
 * not been observed yet (`null`). Use this anywhere the UI renders a live
 * capability value that may not have a reading yet, instead of hand-rolling a
 * null ternary. Conventionally imported aliased as `v` to keep callsites terse.
 */
export function formatValueOrUnknown<T>(value: T | null, format: (value: T) => string): string {
  return value === null ? '-' : format(value);
}
