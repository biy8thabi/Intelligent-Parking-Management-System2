
const BASE = (
  import.meta.env.VITE_API_URL ||
  "https://intelligent-parking-management-system2-4.onrender.com"
).replace(/\/$/, "");

export function configured() {
  return Boolean(BASE);
}

export async function request(path, { token, ...options } = {}) {
  if (!BASE) {
    throw new Error(
      "Backend URL is not configured. Set VITE_API_URL in .env."
    );
  }

  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const err = new Error(
      data.error || data.message || `HTTP ${response.status}`
    );
    err.status = response.status;
    throw err;
  }

  return data;
}

export const adminLogin = (email, password) =>
  request("/api/auth/admin-login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

export const getAdminProfile = (token) =>
  request("/api/auth/me", { token });

export const getActiveSessions = (token) =>
  request("/api/admin/sessions/active", { token });

export const forceEndSession = (token, id) =>
  request(
    `/api/admin/sessions/${encodeURIComponent(id)}/force-end`,
    {
      token,
      method: "POST",
    }
  );

// Parking availability for the Reports page.
export async function getParkingAvailability() {
  const data = await request("/api/parking/availability");

  // Support common API response formats.
  const result = data.data ?? data.availability ?? data;

  return {
    total_spaces: Number(
      result.total_spaces ?? result.totalSpaces ?? result.total ?? 0
    ),
    available_count: Number(
      result.available_count ?? result.availableSpaces ?? result.available ?? 0
    ),
    occupied_count: Number(
      result.occupied_count ?? result.occupiedSpaces ?? result.occupied ?? 0
    ),
    disabled_count: Number(
      result.disabled_count ?? result.disabledSpaces ?? result.disabled ?? 0
    ),
  };
}
