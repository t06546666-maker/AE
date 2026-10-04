import { Capacitor } from '@capacitor/core';

const TOKEN_KEY = 'ae_access_token';
const REFRESH_KEY = 'ae_refresh_token';
let renewal: Promise<void> | null = null;
// Vercel serves the API from the same deployment. Use relative requests on
// the live domain so www and non-www hosts never trigger cross-origin issues.
const configuredApiUrl = import.meta.env.VITE_API_URL || '';
const isLiveAffiliateDomain = typeof window !== 'undefined'
  && window.location.hostname.endsWith('affiliateae.co.in');
// Installed apps must reach the hosted backend, never the phone's localhost.
const API_BASE_URL = Capacitor.isNativePlatform()
  ? 'https://www.affiliateae.co.in'
  : isLiveAffiliateDomain ? '' : configuredApiUrl;

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function setAccessToken(token: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function renewSession() {
  if (renewal) return renewal;
  const previous = getAccessToken();
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return;
  renewal = (async () => {
    let customer = false;
    try { customer = JSON.parse(atob(previous.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'customer'; } catch { /* Server validates token. */ }
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken, customer }) });
    } catch { throw new ApiError('Cannot renew your saved session while offline. Please retry.', 0); }
    if (getAccessToken() !== previous || localStorage.getItem(REFRESH_KEY) !== refreshToken) return;
    if (response.status === 401) { clearAccessToken(); window.dispatchEvent(new Event('ae:unauthorized')); throw new ApiError('Please sign in again.', 401); }
    if (!response.ok) throw new ApiError('Unable to renew your session. Please retry.', response.status);
    const data = await response.json();
    if (getAccessToken() === previous) setAccessToken(data.accessToken, data.refreshToken);
  })().finally(() => { renewal = null; });
  return renewal;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const authenticationRequest = /\/api\/auth\/(?:customer\/)?(?:login|signup|refresh)/.test(path);
  if (!authenticationRequest && localStorage.getItem(REFRESH_KEY)) {
    try {
      const payload = JSON.parse(atob(getAccessToken().split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp * 1000 <= Date.now() + 60_000) await renewSession();
    } catch (error) { if (error instanceof ApiError) throw error; }
  }
  const url = path.startsWith('/') ? `${API_BASE_URL}${path}` : path;
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, { ...init, headers });
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
    const code = typeof payload === 'object' && payload && 'code' in payload
      ? String(payload.code)
      : '';
    if (response.status === 401) {
      clearAccessToken();
      window.dispatchEvent(new Event('ae:unauthorized'));
    }
    if (code === 'PASSWORD_CHANGE_REQUIRED') {
      window.dispatchEvent(new Event('ae:password-change-required'));
    }
    throw new ApiError(message, response.status, code);
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
  const apiUrl = path.startsWith('/') ? `${API_BASE_URL}${path}` : path;
  const token = getAccessToken();
  const response = await fetch(apiUrl, {
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
