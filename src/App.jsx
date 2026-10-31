
import { useCallback, useEffect, useState } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';

import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import CrudPage from './pages/CrudPage';
import FeeCalculator from './pages/FeeCalculator';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { request } from './services/api';

const TOKEN_KEY = 'pw_admin_token';

function ProtectedLayout({ onLogout, theme, onThemeChange }) {
  const location = useLocation();
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const verifySession = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);

    if (!token) {
      setAuthenticated(false);
      setChecking(false);
      return;
    }

    setChecking(true);
    setError('');

    try {
      await request('/api/auth/me', { token });
      setAuthenticated(true);
    } catch (err) {
      sessionStorage.removeItem(TOKEN_KEY);
      setAuthenticated(false);
      setError(err.message || 'Please sign in again.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    verifySession();
  }, [verifySession, location.pathname]);

  if (checking) {
    return (
      <main className="page">
        <p role="status">Checking administrator session…</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location, message: error }}
      />
    );
  }

  return <Layout onLogout={onLogout} theme={theme} onThemeChange={onThemeChange} />;
}

function AppRoutes() {
  const [loginVersion, setLoginVersion] = useState(0);
  const [theme, setTheme] = useState(() => localStorage.getItem('pw_theme') || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('pw_theme', theme);
  }, [theme]);

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY);
    setLoginVersion(version => version + 1);
    window.location.replace('/login');
  }, []);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <Login
            key={loginVersion}
            onLogin={(token) => {
              sessionStorage.setItem(TOKEN_KEY, token);
              window.location.replace('/dashboard');
            }}
          />
        }
      />

      <Route
        element={<ProtectedLayout onLogout={logout} theme={theme} onThemeChange={setTheme} />}
      >
        <Route index element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/sessions" element={<Sessions token={sessionStorage.getItem(TOKEN_KEY)} onUnauthorised={logout} />} />
        <Route path="/active-sessions" element={<Sessions token={sessionStorage.getItem(TOKEN_KEY)} onUnauthorised={logout} />} />

        <Route
          path="/parking-lots"
          element={<CrudPage title="Parking Lots" />}
        />
        <Route
          path="/parking-slots"
          element={<CrudPage title="Parking Slots" />}
        />
        <Route
          path="/bookings"
          element={<CrudPage title="Bookings" />}
        />
        <Route
          path="/drivers"
          element={<CrudPage title="Drivers" />}
        />
        <Route
          path="/vehicles"
          element={<CrudPage title="Vehicles" />}
        />
        <Route
          path="/payments"
          element={<CrudPage title="Payments" />}
        />
        <Route
          path="/qr-tickets"
          element={<CrudPage title="QR Tickets" />}
        />

        <Route path="/fee-calculator" element={<FeeCalculator />} />
        <Route path="/reports" element={<Reports token={sessionStorage.getItem(TOKEN_KEY)} onUnauthorised={logout} />} />
        <Route path="/settings" element={<Settings theme={theme} onThemeChange={setTheme} />} />
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
