
import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";

import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CrudPage from "./pages/CrudPage";
import Settings from "./pages/Settings";
import FeeCalculator from "./pages/FeeCalculator";
import Sessions from "./pages/Sessions";
import Reports from "./pages/Reports";

import { getAdminProfile } from "./services/api";

const names = [
  "Parking Lots",
  "Parking Slots",
  "Drivers",
  "Vehicles",
  "Bookings",
  "Payments",
  "QR Tickets",
];

export default function App() {
  const [token, setToken] = useState(() =>
    sessionStorage.getItem("pw_admin_token")
  );

  const [admin, setAdmin] = useState(null);
  const [checking, setChecking] = useState(Boolean(token));

  const [theme, setTheme] = useState(
    () => localStorage.getItem("pw_theme") || "dark"
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("pw_theme", theme);
  }, [theme]);

  useEffect(() => {
    let active = true;

    if (!token) {
      setAdmin(null);
      setChecking(false);
      return () => {
        active = false;
      };
    }

    setChecking(true);

    getAdminProfile(token)
      .then((data) => {
        if (!active) return;

        if (!data.admin || data.admin.role !== "admin") {
          throw new Error("Not an administrator");
        }

        setAdmin(data.admin);
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;

        sessionStorage.removeItem("pw_admin_token");
        setToken(null);
        setAdmin(null);
        setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const logout = () => {
    sessionStorage.removeItem("pw_admin_token");
    setToken(null);
    setAdmin(null);
  };

  if (checking) {
    return (
      <div className="page">
        <h2>Verifying administrator access…</h2>
      </div>
    );
  }

  if (!token || !admin) {
    return (
      <Login
        onLogin={(value) => {
          sessionStorage.setItem("pw_admin_token", value);
          setToken(value);
        }}
      />
    );
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Layout
            theme={theme}
            onThemeChange={setTheme}
            onLogout={logout}
            admin={admin}
          />
        }
      >
        <Route
          index
          element={
            <Dashboard
              token={token}
              onUnauthorised={logout}
            />
          }
        />

        <Route
          path="active-sessions"
          element={
            <Sessions
              token={token}
              onUnauthorised={logout}
            />
          }
        />

        <Route
          path="reports"
          element={
            <Reports
              token={token}
              onUnauthorised={logout}
            />
          }
        />

        {names.map((name) => (
          <Route
            key={name}
            path={name.toLowerCase().replaceAll(" ", "-")}
            element={<CrudPage title={name} />}
          />
        ))}

        <Route
          path="settings"
          element={
            <Settings
              theme={theme}
              onThemeChange={setTheme}
            />
          }
        />

        <Route
          path="fee-calculator"
          element={<FeeCalculator />}
        />

        <Route
          path="admin-profile"
          element={
            <div className="page">
              <h1>Admin Profile</h1>

              <section className="panel">
                <p>
                  <b>Name:</b> {admin.full_name}
                </p>

                <p>
                  <b>Email:</b> {admin.email}
                </p>

                <p>
                  <b>Role:</b> {admin.role}
                </p>

                <p>
                  Profile editing is not supported by the
                  documented backend API.
                </p>
              </section>
            </div>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
