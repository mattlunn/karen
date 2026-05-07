export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<T> {
  const qs = params && Object.keys(params).length > 0 ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`/api${endpoint}${qs}`);

  if (!res.ok) {
    if (res.status === 401) {
      window.location.assign('/login');
      throw new ApiError(401, 'Unauthorized');
    }
    throw new ApiError(res.status, `Failed to fetch ${endpoint}: ${res.status}`);
  }

  return res.json();
}
