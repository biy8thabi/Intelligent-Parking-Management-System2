import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { changePassword } from "../services/api";
import { PageHead, Card, Notice } from "../components/ui";

// Only settings that actually do something are shown:
//  - Theme: changes the whole site (kept in this browser).
//  - Auto-refresh: how often the live pages reload their data (kept in this browser).
const STORAGE_KEY = "pw_settings";
const DEFAULTS = { refreshInterval: "30" };

// Same rules as the backend: 8 to 72 characters with an uppercase letter, a lowercase letter and a number.
const PASSWORD_RULE = "Use 8 to 72 characters, with an uppercase letter, a lowercase letter and a number.";

function passwordProblem(password) {
  if (password.length < 8 || password.length > 72) return PASSWORD_RULE;
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) return PASSWORD_RULE;
  return "";
}

function readPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export default function Settings({ theme, onThemeChange, token, onUnauthorised }) {
  const [prefs, setPrefs] = useState(readPrefs);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [pwError, setPwError] = useState("");
  const [pwDone, setPwDone] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  async function submitPassword(event) {
    event.preventDefault();
    setPwError("");
    setPwDone(false);

    if (!pw.current) return setPwError("Enter your current password.");
    const problem = passwordProblem(pw.next);
    if (problem) return setPwError(problem);
    if (pw.next !== pw.confirm) return setPwError("The new passwords do not match.");
    if (pw.next === pw.current) return setPwError("The new password must be different from the current one.");

    setPwBusy(true);

    try {
      await changePassword(pw.current, pw.next, token);
      setPw({ current: "", next: "", confirm: "" });
      setPwDone(true);
    } catch (err) {
      if (err.status === 401) {
        onUnauthorised?.();
        return;
      }
      setPwError(err.message);
    } finally {
      setPwBusy(false);
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [prefs]);

  return (
    <div className="page">
      <PageHead title="Settings" subtitle="Personalise how this website looks and behaves. Saved automatically in this browser." />

      <Card title="Appearance" subtitle="Choose the look that works best for you.">
        <div className="choice-row">
          {["light", "dark"].map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => onThemeChange(t)}
              className={"choice" + (theme === t ? " chosen" : "")}
              aria-pressed={theme === t}
            >
              {t === "light" ? "Light mode" : "Dark mode"}
            </button>
          ))}
        </div>
      </Card>

      <Card
        title="Auto-refresh"
        subtitle="How often the Dashboard, Active Sessions, Available Bays and Reports pages reload their data while you are looking at them."
      >
        <div className="form-row">
          <label>
            Refresh interval
            <select
              value={prefs.refreshInterval}
              onChange={(e) => setPrefs({ ...prefs, refreshInterval: e.target.value })}
            >
              <option value="15">Every 15 seconds</option>
              <option value="30">Every 30 seconds</option>
              <option value="60">Every 60 seconds</option>
              <option value="120">Every 2 minutes</option>
            </select>
          </label>
        </div>
      </Card>

      <Card title="Change password" subtitle={PASSWORD_RULE}>
        <form onSubmit={submitPassword} autoComplete="off">
          <div className="form-grid">
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={pw.current}
                onChange={(e) => setPw({ ...pw, current: e.target.value })}
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                value={pw.next}
                onChange={(e) => setPw({ ...pw, next: e.target.value })}
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                autoComplete="new-password"
                value={pw.confirm}
                onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
              />
            </label>
          </div>

          {pwError && <Notice kind="error">{pwError}</Notice>}
          {pwDone && <Notice kind="success">Password changed. Use the new password the next time you sign in.</Notice>}

          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn btn-primary" type="submit" disabled={pwBusy}>
              {pwBusy ? "Saving..." : "Change password"}
            </button>
          </div>
        </form>
      </Card>

      <Card title="Your account">
        <p className="muted">
          Your name, email and role come from the server and are shown on the <Link to="/admin-profile">Admin Profile</Link>{" "}
          page.
        </p>
      </Card>
    </div>
  );
}
