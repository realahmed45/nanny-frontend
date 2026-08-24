const BASE = import.meta.env.VITE_API_BASE || '/api/admin';
const TOKEN_KEY = 'mynanny_admin_token';

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

  const res = await fetch(url.pathname + url.search, {
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
