import { NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  FiGrid,
  FiMap,
  FiUsers,
  FiCalendar,
  FiSettings,
  FiUser,
  FiLogOut,
  FiSun,
  FiMoon,
  FiSearch,
  FiDollarSign,
  FiBarChart2,
} from "react-icons/fi";

const items = [
  ["Dashboard", "/", FiGrid],
  ["Active Sessions", "/sessions", FiCalendar],
  ["Available Bays", "/available-bays", FiMap],
  ["Drivers", "/drivers", FiUsers],
  ["Reports", "/reports", FiBarChart2],
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

  const initials =
    (admin?.full_name || "Administrator")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "AD";

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
            <div className="user-chip">
              <div className="avatar">{initials}</div>

              <span>
                <b>
                  {admin?.full_name || "Administrator"}
                </b>

                <small>Administrator</small>
              </span>
            </div>
          </div>
        </header>

        <Outlet />
      </main>
    </div>
  );
}
