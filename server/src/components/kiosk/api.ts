export function kioskSecret(): string {
  return new URLSearchParams(window.location.search).get('secret') ?? '';
}

export function kioskUrl(path: string, query: Record<string, string | number> = {}): string {
  const params = new URLSearchParams({ secret: kioskSecret() });

  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }

  return `/kiosk/api${path}?${params}`;
}

export async function fetchKiosk<T>(path: string): Promise<T> {
  const response = await fetch(kioskUrl(path));

  if (!response.ok) {
    throw new Error(`The kiosk API returned a ${response.status} for ${path}`);
  }

  return await response.json() as T;
}
