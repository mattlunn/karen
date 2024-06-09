export function applicationFetch(url, body) {
  const headers = {
    'Content-Type': 'application/json'
  };

  return fetch(url, {
    headers,
    credentials: 'same-origin',
    method: body ? 'POST' : 'GET',
    body: body ? JSON.stringify(body) : undefined
  });
}