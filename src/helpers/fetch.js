export function applicationFetch(url, token, body) {
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return fetch(url, {
    headers,
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined
  });
}