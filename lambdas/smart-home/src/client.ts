import fetch from 'cross-fetch';

const BASE_URL = `https://${process.env.KAREN_HOST}/api`;
const AUTH_HEADER = `Bearer ${process.env.KAREN_AUTH_TOKEN}`;

export async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    headers: {
      Authorization: AUTH_HEADER
    }
  });

  if (!res.ok) {
    throw new Error(`API GET ${endpoint} failed: ${res.status}`);
  }

  return res.json();
}

export async function apiPut(endpoint: string, body: object): Promise<void> {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'PUT',
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`API PUT ${endpoint} failed: ${res.status}`);
  }

  // Mutations return 204 No Content, no response body to parse
}
