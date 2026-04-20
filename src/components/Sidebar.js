// src/components/Sidebar.js
import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthProvider";
import {
  Home,
  ChefHat,
  Image,
  Bell,
  Palette,
  PlusCircle,
  Megaphone,
  FilePlus,
  LayoutGrid,
  Newspaper,
  ShieldCheck,
  BarChart3,
  UserCog,
  KeyRound,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Users,
  Star,
} from "lucide-react";
import "./Sidebar.css";

const navItems = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/recipe", label: "Recipes", icon: ChefHat },
  { to: "/imagelib", label: "Image Library", icon: Image },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/recipe-theme", label: "Recipe Themes", icon: Palette },
  { to: "/create-recipe", label: "Create Recipe", icon: PlusCircle },
];

const advertItems = [
  { to: "/adverts", label: "Adverts", icon: Megaphone },
  { to: "/adverts/create", label: "Create Advert", icon: FilePlus },
];

const contentItems = [
  { to: "/categories", label: "Categories", icon: LayoutGrid },
  { to: "/creators", label: "Creators", icon: Star },
  { to: "/feed-admin", label: "Feed Admin", icon: Newspaper },
  { to: "/users", label: "Users", icon: Users },
];

const adminItems = [
  { to: "/admin", label: "Dashboard", icon: BarChart3 },
  { to: "/ai", label: "Gemini Stats", icon: ShieldCheck },
  { to: "/change-role", label: "Change Role", icon: UserCog },
  { to: "/change-password", label: "Change Password", icon: KeyRound },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [adminOpen, setAdminOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Don't render sidebar when not authenticated
  if (!token) return null;

  const isAdmin = user && (user.role === "admin" || user.role === "superAdmin");
  const isActive = (path) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const closeMobile = () => setMobileOpen(false);

  const userInitial = user?.first_name
    ? user.first_name.charAt(0).toUpperCase()
    : user?.email
      ? user.email.charAt(0).toUpperCase()
      : "U";

  const userName = user?.first_name ?? user?.email ?? "User";

  const renderLink = (item) => (
    <Link
      key={item.to}
      to={item.to}
      className={`sidebar-link${isActive(item.to) ? " active" : ""}`}
      data-tooltip={item.label}
      onClick={closeMobile}
    >
      <item.icon className="sidebar-link-icon" />
      <span className="sidebar-link-text">{item.label}</span>
    </Link>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <span className="mobile-brand">Cookeaze Admin</span>
      </div>

      {/* Overlay backdrop for mobile */}
      <div
        className={`sidebar-overlay${mobileOpen ? " visible" : ""}`}
        onClick={closeMobile}
      />

      {/* Sidebar */}
      <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
        {/* Brand */}
        <Link to="/home" className="sidebar-brand" onClick={closeMobile}>
          <div className="sidebar-brand-icon">
            <ChefHat size={20} />
          </div>
          <span className="sidebar-brand-text">Cookeaze</span>
        </Link>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Main</span>
          {navItems.map(renderLink)}

          <span className="sidebar-section-label">Marketing</span>
          {advertItems.map(renderLink)}

          <span className="sidebar-section-label">Content</span>
          {contentItems.map(renderLink)}

          {/* Admin group */}
          {isAdmin && (
            <>
              <span className="sidebar-section-label">Administration</span>
              <button
                className="sidebar-group-toggle"
                onClick={() => setAdminOpen((o) => !o)}
              >
                <ShieldCheck className="sidebar-link-icon" />
                <span className="sidebar-link-text">Admin</span>
                <ChevronDown
                  className={`sidebar-group-chevron${adminOpen ? " open" : ""}`}
                />
              </button>
              <div
                className={`sidebar-group-items${adminOpen ? " expanded" : ""}`}
              >
                {adminItems.map(renderLink)}
              </div>
            </>
          )}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-label">Signed in as</div>
              <div className="sidebar-user-name">{userName}</div>
            </div>
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </div>

        {/* Mobile close button */}
        <button
          className="mobile-menu-btn"
          onClick={closeMobile}
          aria-label="Close menu"
          style={{
            position: "absolute",
            top: 16,
            right: 12,
            display: mobileOpen ? "flex" : "none",
          }}
        >
          <X size={20} />
        </button>
      </aside>
    </>
  );
}
