import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiMonitor, FiCheck, FiRefreshCw, FiUser, FiSettings } from "react-icons/fi";

// Only settings that actually do something are shown:
//  - Theme: changes the whole site (kept in this browser).
//  - Auto-refresh: how often the live pages reload their data (kept in this browser).
const STORAGE_KEY = "pw_settings";
const DEFAULTS = { refreshInterval: "30" };

function readPrefs() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
  } catch {
    return DEFAULTS;
  }
}

export default function Settings({ theme, onThemeChange }) {
  const [prefs, setPrefs] = useState(readPrefs);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* storage unavailable */
    }
  }, [prefs]);

  return (
    <div className="page settings-page">
      <div className="settings-hero">
        <div>
          <div className="eyebrow">PARKWISE CONTROL CENTRE</div>
          <h1>Settings</h1>
          <p>Personalise how this website looks and behaves for you.</p>
        </div>
        <div className="settings-hero-icon">
          <FiSettings />
        </div>
      </div>

      <div className="settings-content" style={{ maxWidth: 900 }}>
        <section className="settings-card" id="appearance">
          <div className="section-heading">
            <div className="section-icon">
              <FiMonitor />
            </div>
            <div>
              <h2>Appearance</h2>
              <p>Choose the look that works best for you.</p>
            </div>
          </div>

          <div className="theme-options">
            {["light", "dark"].map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => onThemeChange(t)}
                className={"theme-choice " + (theme === t ? "chosen" : "")}
                aria-pressed={theme === t}
              >
                <div className={"theme-preview " + t}>
                  <div className="preview-sidebar" />
                  <div className="preview-content">
                    <i />
                    <i />
                    <div>
                      <b />
                      <b />
                      <b />
                    </div>
                  </div>
                </div>
                <span>
                  <b>{t === "light" ? "Light mode" : "Dark mode"}</b>
                  <small>
                    {t === "light" ? "Bright, clean and airy" : "Easy on the eyes in low light"}
                  </small>
                </span>
                <span className="theme-check">{theme === t ? <FiCheck /> : null}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-card" id="refresh">
          <div className="section-heading">
            <div className="section-icon">
              <FiRefreshCw />
            </div>
            <div>
              <h2>Auto-refresh</h2>
              <p>How often live pages (Dashboard, Active Sessions, Available Bays and Reports) reload their data while you are looking at them.</p>
            </div>
          </div>

          <div className="form-grid">
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
        </section>

        <section className="settings-card" id="account">
          <div className="section-heading">
            <div className="section-icon">
              <FiUser />
            </div>
            <div>
              <h2>Your account</h2>
              <p>
                Your name, email and role come from the server and are shown on the{" "}
                <Link to="/admin-profile">Admin Profile</Link> page. Changing your password is not
                available from this website yet.
              </p>
            </div>
          </div>
        </section>

        <div className="settings-footer">
          <span>
            <FiCheck /> Changes are saved automatically in this browser.
          </span>
        </div>
      </div>
    </div>
  );
}
