/**
 * Where the admin API lives.
 *
 * VITE_API_BASE wins when set. Otherwise we fall back to the deployed backend
 * in a production build, and to the Vite dev proxy when running locally — so
 * the dashboard works out of the box without any environment configuration.
 *
 * Whatever the source, a trailing slash and a stray "/auth/login" suffix are
 * trimmed: the value is a base that request paths get appended to, and both
 * are easy mistakes to make in a hosting dashboard.
 */
const DEFAULT_PROD_API = 'https://nanny-backend-hw1q.onrender.com/api/admin';

const rawBase = import.meta.env.VITE_API_BASE
  || (import.meta.env.PROD ? DEFAULT_PROD_API : '/api/admin');

const BASE = String(rawBase)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/auth\/login$/, '');
const TOKEN_KEY = 'mynanny_admin_token';

/**
 * Turn a stored media path into something this page can load.
 *
 * Media is stored as "/media/abc.jpg" — a path, so the same record works on
 * localhost, on Render, and behind any domain put in front later. But the
 * dashboard is served from somewhere else entirely (Vercel), where that path
 * resolves to the static host and 404s. The file lives with the API, so the
 * path has to be resolved against the API's origin rather than the page's.
 *
 * Absolute URLs are returned untouched: anything already pointing somewhere
 * specific was put there deliberately.
 */
const API_ORIGIN = (() => {
  try {
    return new URL(BASE, window.location.origin).origin;
  } catch {
    return window.location.origin;
  }
})();

export function mediaUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url) || url.startsWith('data:')) return url;
  return `${API_ORIGIN}${url.startsWith('/') ? '' : '/'}${url}`;
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (t) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

/**
 * Thin fetch wrapper: attaches the bearer token, parses JSON, and turns a
 * non-2xx response into a thrown Error carrying the server's message.
 * A 401 clears the token so the app falls back to the login screen.
 */
export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}${path}`, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
    });
  }

  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  // Send the absolute URL: in production VITE_API_BASE points at another
  // origin (Render), and dropping it would post to the static host instead.
  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('mynanny:unauthorized'));
    throw new Error('Your session has expired. Please sign in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const login = (email, password) =>
  api('/auth/login', { method: 'POST', body: { email, password } });

export default api;
