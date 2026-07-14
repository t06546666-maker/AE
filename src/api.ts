const TOKEN_KEY = 'ae_access_token';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'object' && payload && 'error' in payload
      ? String(payload.error)
      : String(payload || 'Request failed');
    if (response.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new Event('ae:unauthorized'));
    }
    throw new ApiError(message, response.status);
  }
  return payload as T;
}

export function queryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  return params.toString();
}

export async function downloadExport(path: string) {
  const token = getAccessToken();
  const response = await fetch(path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error || 'Export failed', response.status);
  }
  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') || '';
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || 'affiliate-ae-report';
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
