const ROOT_URL = `https://${process.env.KAREN_HOST}`;
const AUTH_HEADER = `Bearer ${process.env.KAREN_AUTH_TOKEN}`;

export async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(`${ROOT_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`API POST ${endpoint} failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}
