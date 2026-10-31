import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  FiGrid,
  FiMapPin,
  FiMap,
  FiUsers,
  FiTruck,
  FiCalendar,
  FiCreditCard,
  FiGrid as FiTicket,
  FiSettings,
  FiUser,
  FiLogOut,
  FiSun,
  FiMoon,
  FiBell,
  FiSearch,
  FiDollarSign,
  FiBarChart2,
} from "react-icons/fi";

const items = [
  ["Dashboard", "/", FiGrid],
  ["Active Sessions", "/sessions", FiCalendar],
  ["Reports", "/reports", FiBarChart2],
  ["Parking Lots", "/parking-lots", FiMapPin],
  ["Parking Slots", "/parking-slots", FiMap],
  ["Drivers", "/drivers", FiUsers],
  ["Vehicles", "/vehicles", FiTruck],
  ["Bookings", "/bookings", FiCalendar],
  ["Payments", "/payments", FiCreditCard],
  ["QR Tickets", "/qr-tickets", FiTicket],
  ["Fee Calculator", "/fee-calculator", FiDollarSign],
  ["Settings", "/settings", FiSettings],
  ["Admin Profile", "/admin-profile", FiUser],
];

export default function Layout({
  onLogout,
  theme,
  onThemeChange,
  admin,
}) {
  const navigate = useNavigate();

  // Type a page name (e.g. "reports") and press Enter to jump to it.
  function jumpToPage(event) {
    if (event.key !== "Enter") return;

    const term = event.currentTarget.value.trim().toLowerCase();
    if (!term) return;

    const match = items.find(([name]) => name.toLowerCase().includes(term));

    if (match) {
      navigate(match[1]);
      event.currentTarget.value = "";
    }
  }

  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">P</span>

          <span>
            <b>ParkWise</b>
            <small>ADMIN PORTAL</small>
          </span>
        </div>

        <div className="nav-label">WORKSPACE</div>

        <nav>
          {items.map(([name, path, Icon]) => (
            <NavLink
              key={name}
              to={path}
              end={name === "Dashboard"}
            >
              <Icon />
              <span>{name}</span>

              {name === "Settings" && (
                <span className="nav-dot" />
              )}
            </NavLink>
          ))}
        </nav>

        <div className="side-bottom">
          <div className="side-promo">
            <div className="promo-orb">✦</div>

            <b>
              Smart parking.
              <br />
              Better tomorrow.
            </b>

            <small>
              Manage your facility with confidence.
            </small>
          </div>

          <button
            className="logout"
            type="button"
            onClick={onLogout}
          >
            <FiLogOut />
            Sign out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="top-search">
            <FiSearch />

            <input
              placeholder="Jump to a page (e.g. Reports)..."
              aria-label="Jump to a page"
              onKeyDown={jumpToPage}
            />
          </div>

          <div className="top-actions">
            <button
              className="icon-button"
              type="button"
              title="Toggle theme"
              aria-label="Toggle theme"
              onClick={() =>
                onThemeChange(
                  theme === "dark" ? "light" : "dark"
                )
              }
            >
              {theme === "dark" ? <FiSun /> : <FiMoon />}
            </button>

            <button
              className="icon-button notification-button"
              type="button"
              title="Notifications"
              aria-label="Open notification settings"
              onClick={() => navigate("/settings")}
            >
              <FiBell />
            </button>

            <div className="user-chip">
              <div className="avatar">AD</div>

              <span>
                <b>
                  {admin?.full_name || "Administrator"}
                </b>

                <small>System Admin</small>
              </span>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
