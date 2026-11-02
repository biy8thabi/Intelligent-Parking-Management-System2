import { useState } from "react";
import { useLocation } from "react-router-dom";
import { adminLogin, configured } from "../services/api";

export default function Login({ onLogin }) {
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState(location.state?.message || "");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);

    try {
      const data = await adminLogin(email.trim(), password);

      if (!data?.token || data.admin?.role !== "admin") {
        throw new Error("Server did not return an administrator login.");
      }

      const from = location.state?.from;
      const redirectTo = from?.pathname && from.pathname !== "/login"
        ? `${from.pathname}${from.search || ""}`
        : "/";

      onLogin(data.token, data.admin, redirectTo);
    } catch (err) {
      setError(err.message || "Could not sign in.");
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-info">
        <div className="logo">P</div>
        <h1>ParkWise</h1>
        <p>Smart Parking Management System</p>
        <div className="info-card">
          <h3>Admin Portal</h3>
          <p>Manage parking operations from one central website.</p>
          <ul>
            <li>Manage parking operations</li>
            <li>Monitor active sessions</li>
            <li>Review admin profile</li>
            <li>Personalise admin settings</li>
          </ul>
        </div>
      </section>

      <section className="login-form">
        <form onSubmit={submit}>
          <h1>Welcome Back</h1>
          <p>Sign in to access the admin dashboard.</p>

          {!configured && (
            <div className="error">
              Backend URL is not configured. Add VITE_API_URL to your .env file.
            </div>
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}

          <label>
            Email address
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </label>

          <label>
            Password
            <div className="pw">
              <input
                type={show ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
              />
              <button type="button" onClick={() => setShow(!show)}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button className="primary" disabled={busy || !configured}>
            {busy ? "Signing in…" : "Sign In"}
          </button>

          <div className="note">
            Only administrator accounts created by your backend team can sign in.
          </div>
        </form>
      </section>
    </div>
  );
}
