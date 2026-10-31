
const API_BASE = (
  import.meta.env.VITE_API_URL ||
  'https://intelligent-parking-management-system2-4.onrender.com'
).replace(/\/+$/, '');

export const configured = Boolean(API_BASE);

export async function request(path, options = {}) {
  if (typeof path !== 'string' || !path.startsWith('/')) {
    throw new Error('API paths must start with /.');
  }

  const {
    token,
    headers: suppliedHeaders = {},
    body,
    ...fetchOptions
  } = options;

  const headers = new Headers(suppliedHeaders);

  if (body !== undefined && body !== null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response;

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
      body:
        body !== undefined && body !== null &&
        typeof body !== 'string'
          ? JSON.stringify(body)
          : body,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new Error(
      'Cannot connect to the ParkWise server. Check your internet connection. If the server was idle it may take up to a minute to wake up, so try again shortly.'
    );
  }

  if (response.status === 204) {
    return {};
  }

  const contentType = response.headers.get('content-type') || '';
  let data;

  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      throw new Error('The ParkWise server returned invalid JSON.');
    }
  } else {
    const responseText = await response.text();
    data = responseText ? { message: responseText } : {};
  }

  if (!response.ok) {
    const serverMessage = data?.error || data?.message;
    let message = serverMessage || `Request failed with HTTP ${response.status}.`;

    if (response.status === 401) {
      message =
        serverMessage ||
        'Authentication failed or your session has expired. Please sign in again.';
    } else if (response.status === 403) {
      message = 'You do not have permission to perform this action.';
    } else if (response.status === 404) {
      message = 'The requested API endpoint or record was not found.';
    }

    // Pages rely on err.status to detect an expired/invalid session.
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return data;
}

export function getApiBaseUrl() {
  return API_BASE;
}

export async function adminLogin(email, password) {
  return request('/api/auth/admin-login', {
    method: 'POST',
    body: { email, password },
  });
}

export async function getActiveSessions(token) {
  return request('/api/admin/sessions/active', { token });
}

export async function forceEndSession(id, token) {
  return request(
    `/api/admin/sessions/${encodeURIComponent(id)}/force-end`,
    { method: 'POST', token }
  );
}

export async function getParkingAvailability() {
  return request('/api/parking/availability');
}
