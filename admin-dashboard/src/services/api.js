const BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export function configured() { return Boolean(BASE); }
export async function request(path, { token, ...options } = {}) {
  if (!BASE) throw new Error("Backend URL is not configured. Set VITE_API_URL in .env.");
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) { const err = new Error(data.error || data.message || `HTTP ${response.status}`); err.status = response.status; throw err; }
  return data;
}
export const adminLogin = (email, password) => request("/api/auth/admin-login", { method: "POST", body: JSON.stringify({ email, password }) });
export const getAdminProfile = token => request("/api/auth/me", { token });
export const getActiveSessions = token => request("/api/admin/sessions/active", { token });
export const forceEndSession = (token, id) => request(`/api/admin/sessions/${encodeURIComponent(id)}/force-end`, { token, method: "POST" });
