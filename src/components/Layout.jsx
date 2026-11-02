import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  FiGrid,
  FiClock,
  FiMap,
  FiUsers,
  FiBarChart2,
  FiDollarSign,
  FiFileText,
  FiLayers,
  FiKey,
  FiTag,
  FiTruck,
  FiSettings,
  FiUser,
  FiLogOut,
  FiSun,
  FiMoon,
} from "react-icons/fi";

// The sidebar menu, grouped so related pages sit together.
const groups = [
  {
    label: "OVERVIEW",
    items: [["Dashboard", "/", FiGrid]],
  },
  {
    label: "OPERATIONS",
    items: [
      ["Active Sessions", "/sessions", FiClock],
      ["Session History", "/history", FiFileText],
      ["Available Bays", "/available-bays", FiMap],
      ["Parking Spaces", "/parking-spaces", FiLayers],
      ["Tickets", "/tickets", FiTag],
    ],
  },
  {
    label: "PEOPLE AND VEHICLES",
    items: [
      ["Drivers", "/drivers", FiUsers],
      ["Vehicles", "/vehicles", FiTruck],
      ["Password Requests", "/password-requests", FiKey],
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      ["Reports", "/reports", FiBarChart2],
      ["Fee Calculator", "/fee-calculator", FiDollarSign],
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      ["Settings", "/settings", FiSettings],
      ["Admin Profile", "/admin-profile", FiUser],
    ],
  },
];

const allItems = groups.flatMap((g) => g.items);

export default function Layout({ onLogout, theme, onThemeChange, admin }) {
  const { pathname } = useLocation();

  // The page name shown in the top bar.
  const current = allItems.find(([, path]) => path === pathname);
  const pageName = current ? current[0] : "ParkWise Admin";

  const name = admin?.full_name || "Administrator";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("") || "AD";

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span>
            <b>ParkWise</b>
            <small>ADMIN PORTAL</small>
          </span>
        </div>

        <nav className="nav" aria-label="Main menu">
          {groups.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map(([label, path, Icon]) => (
                <NavLink
                  key={path}
                  to={path}
                  end={path === "/"}
                  className={({ isActive }) => (isActive ? "active" : "")}
                >
                  <Icon aria-hidden="true" />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <button className="signout" type="button" onClick={onLogout}>
          <FiLogOut aria-hidden="true" />
          Sign out
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <strong>{pageName}</strong>

          <div className="top-right">
            <button
              className="icon-btn"
              type="button"
              title="Switch light or dark theme"
              aria-label="Switch light or dark theme"
              onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <FiSun /> : <FiMoon />}
            </button>

            <div className="user">
              <div className="avatar">{initials}</div>
              <div>
                <div className="user-name">{name}</div>
                <div className="user-role">Administrator</div>
              </div>
            </div>
          </div>
        </header>

        <Outlet />
      </div>
    </div>
  );
}
