import { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sessions from "./pages/Sessions";
import Payments from "./pages/CrudPage";
import Vehicles from "./pages/Vehicles";
import FeeCalculator from "./pages/FeeCalculator";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import AdminProfile from "./pages/AdminProfile";
import ComingSoon from "./pages/ComingSoon";
import { request } from "./services/api";
import {
  clearToken,
  getStoredTheme,
  getToken,
  setToken,
  storeTheme,
} from "./auth";

// Checks the stored token with the backend once, then renders the portal.
function ProtectedLayout({ admin, onAdmin, theme, onThemeChange, onLogout }) {
  const location = useLocation();
  const [checking, setChecking] = useState(!admin);
  const [error, setError] = useState("");
  const token = getToken();

  useEffect(() => {
    if (admin || !token) {
      setChecking(false);
      return undefined;
    }

    let active = true;

    request("/api/auth/me", { token })
      .then((data) => {
        if (!active) return;
        onAdmin(data?.admin ?? data?.user ?? {});
      })
      .catch((err) => {
        if (!active) return;
        // Only drop the session when the server actually rejected it.
        if (err.status === 401 || err.status === 403) {
          clearToken();
        }
        setError(err.message || "Please sign in again.");
      })
      .finally(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [admin, token, onAdmin]);

  if (checking) {
    return (
      <main className="page">
        <p role="status">Checking administrator session...</p>
      </main>
    );
  }

  if (!getToken()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, message: error }}
      />
    );
  }

  if (error && !admin) {
    return (
      <main className="page">
        <p role="alert" className="error">
          {error}
        </p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    );
  }

  return (
    <Layout
      admin={admin}
      theme={theme}
      onThemeChange={onThemeChange}
      onLogout={onLogout}
    />
  );
}

function AppRoutes() {
  const navigate = useNavigate();
  const [admin, setAdmin] = useState(null);
  const [theme, setTheme] = useState(getStoredTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    storeTheme(theme);
  }, [theme]);

  const logout = useCallback(() => {
    clearToken();
    setAdmin(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  const handleLogin = useCallback(
    (token, adminData, redirectTo = "/") => {
      setToken(token);
      setAdmin(adminData ?? null);
      navigate(redirectTo, { replace: true });
    },
    [navigate]
  );

  // Pages that need the token get it here, so they never read storage themselves.
  const token = getToken();

  return (
    <Routes>
      <Route path="/login" element={<Login onLogin={handleLogin} />} />

      <Route
        element={
          <ProtectedLayout
            admin={admin}
            onAdmin={setAdmin}
            theme={theme}
            onThemeChange={setTheme}
            onLogout={logout}
          />
        }
      >
        <Route
          index
          element={<Dashboard token={token} onUnauthorised={logout} />}
        />
        <Route
          path="/dashboard"
          element={<Dashboard token={token} onUnauthorised={logout} />}
        />
        <Route
          path="/sessions"
          element={<Sessions token={token} onUnauthorised={logout} />}
        />
        <Route path="/active-sessions" element={<Navigate to="/sessions" replace />} />
        <Route
          path="/reports"
          element={<Reports token={token} onUnauthorised={logout} />}
        />
        <Route path="/vehicles" element={<Vehicles onUnauthorised={logout} />} />
        <Route path="/payments" element={<Payments onUnauthorised={logout} />} />

        {/* Backend routes for these do not exist yet. */}
        <Route path="/parking-lots" element={<ComingSoon title="Parking Lots" />} />
        <Route path="/parking-slots" element={<ComingSoon title="Parking Slots" />} />
        <Route path="/bookings" element={<ComingSoon title="Bookings" />} />
        <Route path="/drivers" element={<ComingSoon title="Drivers" />} />
        <Route path="/qr-tickets" element={<ComingSoon title="QR Tickets" />} />

        <Route path="/fee-calculator" element={<FeeCalculator />} />
        <Route
          path="/settings"
          element={<Settings theme={theme} onThemeChange={setTheme} />}
        />
        <Route path="/admin-profile" element={<AdminProfile admin={admin} />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
