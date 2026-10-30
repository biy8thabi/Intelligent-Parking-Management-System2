
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiActivity,
  FiMapPin,
  FiLayers,
  FiCalendar,
  FiUsers,
  FiTruck,
  FiCreditCard,
  FiDollarSign,
  FiBarChart2,
  FiSettings,
  FiLogOut,
  FiMenu,
  FiX,
  FiSun,
  FiMoon,
  FiShield,
  FiChevronRight,
  FiTicket,
} from 'react-icons/fi';
import { useEffect, useState } from 'react';

const navigation = [
  {
    heading: 'OVERVIEW',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: FiGrid },
      { label: 'Sessions', path: '/sessions', icon: FiActivity },
    ],
  },
  {
    heading: 'PARKING MANAGEMENT',
    items: [
      { label: 'Parking Lots', path: '/parking-lots', icon: FiMapPin },
      { label: 'Parking Slots', path: '/parking-slots', icon: FiLayers },
      { label: 'Bookings', path: '/bookings', icon: FiCalendar },
    ],
  },
  {
    heading: 'PEOPLE & PAYMENTS',
    items: [
      { label: 'Drivers', path: '/drivers', icon: FiUsers },
      { label: 'Vehicles', path: '/vehicles', icon: FiTruck },
      { label: 'Payments', path: '/payments', icon: FiCreditCard },
      { label: 'QR Tickets', path: '/qr-tickets', icon: FiTicket },
      { label: 'Fee Calculator', path: '/fee-calculator', icon: FiDollarSign },
    ],
  },
  {
    heading: 'SYSTEM',
    items: [
      { label: 'Reports', path: '/reports', icon: FiBarChart2 },
      { label: 'Settings', path: '/settings', icon: FiSettings },
    ],
  },
];

export default function Layout({ onLogout }) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('pw_admin_theme') === 'dark';
  });

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('pw_admin_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  function handleLogout() {
    if (typeof onLogout === 'function') {
      onLogout();
    } else {
      sessionStorage.removeItem('pw_admin_token');
      navigate('/login', { replace: true });
    }
  }

  function closeSidebar() {
    setSidebarOpen(false);
  }

  return (
    <div className={`app-shell ${darkMode ? 'theme-dark' : 'theme-light'}`}>
      {sidebarOpen && (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Close navigation menu"
          onClick={closeSidebar}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon">
            <FiShield size={23} />
          </div>

          <div className="brand-copy">
            <h2>ParkWise</h2>
            <span>ADMIN CONSOLE</span>
          </div>

          <button
            type="button"
            className="icon-button sidebar-close"
            aria-label="Close sidebar"
            onClick={closeSidebar}
          >
            <FiX />
          </button>
        </div>

        <div className="admin-status">
          <span className="status-indicator" />
          <div>
            <strong>Administrator</strong>
            <span>Management workspace</span>
          </div>
        </div>

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.heading}>
              <p className="nav-heading">{group.heading}</p>

              {group.items.map(({ label, path, icon: Icon }) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={closeSidebar}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'nav-link-active' : ''}`
                  }
                >
                  <Icon className="nav-icon" size={18} />
                  <span>{label}</span>
                  <FiChevronRight className="nav-chevron" size={15} />
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-brand">
            <div className="footer-brand-icon">
              <FiShield />
            </div>
            <div>
              <strong>ParkWise</strong>
              <span>Intelligent Parking</span>
            </div>
          </div>

          <p>Secure parking management.</p>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button menu-button"
              aria-label="Open navigation menu"
              onClick={() => setSidebarOpen(true)}
            >
              <FiMenu size={21} />
            </button>

            <div className="breadcrumb">
              <span>ParkWise</span>
              <FiChevronRight size={14} />
              <strong>Admin Portal</strong>
            </div>
          </div>

          <div className="topbar-actions">
            <div className="topbar-admin">
              <div className="admin-avatar">
                <FiShield />
              </div>
              <div className="topbar-admin-copy">
                <strong>Administrator</strong>
                <span>Admin account</span>
              </div>
            </div>

            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={() => setDarkMode((current) => !current)}
              aria-label={
                darkMode ? 'Switch to light mode' : 'Switch to dark mode'
              }
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <FiSun size={18} /> : <FiMoon size={18} />}
            </button>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
            >
              <FiLogOut size={17} />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="main-content">
          <Outlet />
        </main>

        <footer className="main-footer">
          <span>ParkWise Admin Console</span>
          <span>Intelligent Parking Management System</span>
        </footer>
      </div>
    </div>
  );
}
