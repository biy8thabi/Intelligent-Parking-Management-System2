
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiShield,
  FiMail,
  FiLock,
  FiEye,
  FiEyeOff,
  FiArrowRight,
  FiAlertCircle,
  FiLoader,
} from 'react-icons/fi';
import { request } from '../services/api';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      setError('Please enter your administrator email and password.');
      return;
    }

    setLoading(true);

    try {
      const result = await request('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({
          email: cleanEmail,
          password,
        }),
      });

      const token =
        result?.token ||
        result?.access_token ||
        result?.session?.access_token;

      if (typeof token !== 'string' || !token.trim()) {
        throw new Error(
          'The server did not return an authentication token. Check the backend login response.'
        );
      }

      sessionStorage.setItem('pw_admin_token', token);

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(
        err?.message ||
          'Unable to sign in. Please check your details and try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-decoration login-decoration-one" />
      <div className="login-decoration login-decoration-two" />

      <section className="login-card">
        <div className="login-brand">
          <div className="login-brand-icon">
            <FiShield size={30} />
          </div>

          <div>
            <h1>ParkWise</h1>
            <p>INTELLIGENT PARKING</p>
          </div>
        </div>

        <div className="login-heading">
          <span className="login-eyebrow">ADMINISTRATOR ACCESS</span>
          <h2>Welcome back</h2>
          <p>Sign in to manage your parking operations.</p>
        </div>

        {error && (
          <div className="login-error" role="alert">
            <FiAlertCircle size={19} />
            <span>{error}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="admin-email">Email address</label>

            <div className="login-input-wrapper">
              <FiMail className="login-input-icon" size={19} />

              <input
                id="admin-email"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="admin@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="admin-password">Password</label>

            <div className="login-input-wrapper">
              <FiLock className="login-input-icon" size={19} />

              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />

              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                disabled={loading}
              >
                {showPassword ? (
                  <FiEyeOff size={19} />
                ) : (
                  <FiEye size={19} />
                )}
              </button>
            </div>
          </div>

          <button
            className="login-submit"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <FiLoader className="login-spinner" size={18} />
                Signing in...
              </>
            ) : (
              <>
                Sign in to dashboard
                <FiArrowRight size={18} />
              </>
            )}
          </button>
        </form>

        <div className="login-security-note">
          <FiShield size={17} />
          <span>Restricted access for authorised administrators.</span>
        </div>
      </section>

      <p className="login-copyright">
        © {new Date().getFullYear()} ParkWise · Intelligent Parking Management
        System
      </p>
    </div>
  );
}
