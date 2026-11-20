const BASE = '/api';

// The App sets this so api.js can flip the UI back to the login screen
// the moment any request comes back unauthenticated (e.g. session expired).
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  });
  if (res.status === 401) {
    onUnauthorized();
    throw new Error('Session expired, please log in again');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: (path, optionsOrParams) => {
    let finalPath = path;
    const p = optionsOrParams?.params || (optionsOrParams && !optionsOrParams.headers && !optionsOrParams.method ? optionsOrParams : null);
    if (p) {
      const q = new URLSearchParams();
      Object.entries(p).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') q.append(k, v);
      });
      const qs = q.toString();
      if (qs) {
        finalPath += (finalPath.includes('?') ? '&' : '?') + qs;
      }
    }
    return request(finalPath, optionsOrParams && (optionsOrParams.headers || optionsOrParams.method) ? optionsOrParams : {});
  },
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  put: (path, data) => request(path, { method: 'PUT', body: JSON.stringify(data) }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: async (path, formData) => {
    const res = await fetch(`${BASE}${path}`, { method: 'POST', credentials: 'include', body: formData });
    if (res.status === 401) {
      onUnauthorized();
      throw new Error('Session expired, please log in again');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Upload failed: ${res.status}`);
    }
    return res.json();
  }
};

export function formatMoney(amount, symbol = '₹') {
  const n = Number(amount || 0);
  return `${symbol}${n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

export function todayISO() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function thisMonth() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
