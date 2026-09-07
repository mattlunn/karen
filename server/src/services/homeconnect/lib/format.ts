export function formatProgramName(key: string): string {
  const last = key.split('.').at(-1) ?? key;
  return last
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/\s*Watt$/, 'W');
}
