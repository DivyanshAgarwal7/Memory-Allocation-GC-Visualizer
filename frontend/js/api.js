/**
 * api.js
 * Thin wrapper around fetch for the auth API.
 * - Always sends/receives cookies (httpOnly session tokens)
 * - Normalizes error responses into thrown Error objects with .details
 * - Automatically retries once via /api/auth/refresh on a 401
 */

const BASE = '/api/auth';

async function parseJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function request(path, options = {}, retry = true) {
  const response = await fetch(BASE + path, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && retry && path !== '/refresh') {
    const refreshed = await fetch(BASE + '/refresh', { method: 'POST', credentials: 'include' });
    if (refreshed.ok) {
      return request(path, options, false);
    }
  }

  const data = await parseJson(response);

  if (!response.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = response.status;
    err.details = data.details || [];
    throw err;
  }

  return data;
}

export const authApi = {
  signup: (payload) => request('/signup', { method: 'POST', body: payload }),
  login:  (payload) => request('/login',  { method: 'POST', body: payload }),
  logout: () => request('/logout', { method: 'POST' }),
  me:     () => request('/me'),
  forgotPassword: (payload) => request('/forgot-password', { method: 'POST', body: payload }),
  resetPassword:  (payload) => request('/reset-password',  { method: 'POST', body: payload }),
};
