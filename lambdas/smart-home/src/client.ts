import fetch from 'cross-fetch';

const BASE_URL = `https://${process.env.KAREN_HOST}/api`;
const ROOT_URL = `https://${process.env.KAREN_HOST}`;
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

export async function apiPut<T>(endpoint: string, body: object): Promise<T> {
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

  return res.json();
}

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

  return res.json();
}
