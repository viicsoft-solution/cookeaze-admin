// src/components/Sidebar.js
import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthProvider";
import {
  Home,
  ChefHat,
  Image,
  Bell,
  Palette,
  Megaphone,
  // FilePlus,
  LayoutGrid,
  Newspaper,
  ShieldCheck,
  BarChart3,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Users,
  Star,
  MessageSquare,
  Warehouse,
  Layers,
  Wallet,
  Scale,
  Tag,
  ShoppingBasket,
  Boxes,
  Ticket,
} from "lucide-react";
import "./Sidebar.css";

const navGroups = [
  {
    key: "admin",
    title: "Administration",
    icon: ShieldCheck,
    items: [
      { to: "/admin", label: "Analytics Overview", icon: BarChart3 },
      { to: "/finance", label: "Finance & Withdrawals", icon: Wallet },
      { to: "/disputes", label: "Order Disputes", icon: Scale },
      { to: "/users", label: "Users & Access", icon: Users },
      { to: "/creators", label: "Creators", icon: Star },
      { to: "/ai", label: "Gemini Usage", icon: ShieldCheck },
    ],
  },
  {
    key: "recipes",
    title: "Recipes & Culinary",
    icon: ChefHat,
    items: [
      { to: "/recipe", label: "All Recipes", icon: ChefHat },
      { to: "/categories", label: "Categories", icon: LayoutGrid },
      { to: "/recipe-theme", label: "Recipe Themes", icon: Palette },
      { to: "/imagelib", label: "Image Library", icon: Image },
    ],
  },
  {
    key: "operations",
    title: "Operations & Hubs",
    icon: Layers,
    items: [
      { to: "/warehouses", label: "Warehouses", icon: Warehouse },
      { to: "/ingredients-catalog", label: "Ingredients Catalog", icon: ShoppingBasket },
      { to: "/meal-packs", label: "Meal Packs", icon: Boxes },
      { to: "/feed-admin", label: "Community Feed", icon: Newspaper },
      { to: "/feedback", label: "App Feedback", icon: MessageSquare },
    ],
  },
  {
    key: "marketing",
    title: "Marketing & Alerts",
    icon: Megaphone,
    items: [
      { to: "/campaigns", label: "Promo Campaigns", icon: Tag },
      { to: "/coupons", label: "Coupons & Codes", icon: Ticket },
      // { to: "/adverts", label: "Ad Campaigns", icon: Megaphone },
      // { to: "/adverts/create", label: "New Advert", icon: FilePlus },
      { to: "/notifications", label: "Push Notifications", icon: Bell },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = useCallback(
    (path) => {
      const p = location.pathname;
      if (p === path) return true;
      if (
        path === "/recipe" &&
        (p === "/create-recipe" || p.startsWith("/recipe/"))
      ) {
        return true;
      }
      if (path === "/warehouses" && p.startsWith("/warehouses/")) return true;
      if (path === "/finance" && p === "/withdrawals") return true;
      if (path === "/campaigns" && p.startsWith("/admin-dashboard/campaigns")) return true;
      if (path === "/categories" && p.startsWith("/categories/")) return true;
      if (path === "/creators" && p.startsWith("/creators/")) return true;
      if (
        path === "/adverts" &&
        p.startsWith("/adverts/") &&
        p !== "/adverts/create"
      ) {
        return true;
      }
      return false;
    },
    [location.pathname]
  );

  const groupHasActive = useCallback(
    (items) => items.some((item) => isActive(item.to)),
    [isActive]
  );

  // Open Administration and Recipes by default, plus whichever group contains the active route
  const [openGroups, setOpenGroups] = useState(() => ({
    admin: true,
    recipes: true,
    operations: false,
    marketing: false,
  }));

  useEffect(() => {
    setOpenGroups((prev) => {
      const next = { ...prev };
      navGroups.forEach((g) => {
        if (groupHasActive(g.items)) {
          next[g.key] = true;
        }
      });
      return next;
    });
  }, [location.pathname, groupHasActive]);

  if (!token) return null;

  const toggleGroup = (key) => {
    setOpenGroups((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const closeMobile = () => setMobileOpen(false);

  const userInitial = user?.first_name
    ? user.first_name.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : "A";

  const userName = user?.first_name
    ? `${user.first_name} ${user.last_name || ""}`.trim()
    : user?.email?.split("@")[0] ?? "Admin";

  const userEmail = user?.email || "Administrator";

  return (
    <>
      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={20} />
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
        {/* Brand Header */}
        <div className="sidebar-header">
          <Link to="/home" className="sidebar-brand" onClick={closeMobile}>
            <div className="sidebar-brand-icon">
              <ChefHat size={19} />
            </div>
            <div className="sidebar-brand-copy">
              <span className="sidebar-brand-text">Cookeaze</span>
              <span className="sidebar-brand-badge">Admin Workspace</span>
            </div>
          </Link>

          <button
            type="button"
            className="sidebar-mobile-close"
            onClick={closeMobile}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {/* Primary Home Link */}
          <div className="sidebar-top-links">
            <Link
              to="/home"
              className={`sidebar-parent-link${
                isActive("/home") ? " active" : ""
              }`}
              data-tooltip="Home"
              onClick={closeMobile}
            >
              <span className="sidebar-icon-box">
                <Home size={16} />
              </span>
              <span className="sidebar-link-text">Home Overview</span>
            </Link>
          </div>

          <div className="sidebar-divider-label">Navigation</div>

          {/* Collapsible Navigation Groups */}
          <div className="sidebar-groups-stack">
            {navGroups.map((group) => {
              const isOpen = Boolean(openGroups[group.key]);
              const hasActiveChild = groupHasActive(group.items);
              const GroupIcon = group.icon;

              return (
                <div
                  key={group.key}
                  className={`sidebar-group-card${isOpen ? " is-open" : ""}${
                    hasActiveChild ? " has-active-child" : ""
                  }`}
                >
                  <button
                    type="button"
                    className={`sidebar-group-toggle${
                      hasActiveChild ? " active-parent" : ""
                    }`}
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={isOpen}
                  >
                    <span className="sidebar-icon-box">
                      <GroupIcon size={16} />
                    </span>
                    <span className="sidebar-link-text">{group.title}</span>
                    <ChevronRight
                      size={15}
                      className={`sidebar-group-chevron${isOpen ? " open" : ""}`}
                    />
                  </button>

                  <div
                    className={`sidebar-group-items${
                      isOpen ? " expanded" : ""
                    }`}
                  >
                    <div className="sidebar-tree-list">
                      {group.items.map((item) => {
                        const active = isActive(item.to);
                        const SubIcon = item.icon;
                        return (
                          <Link
                            key={item.to}
                            to={item.to}
                            className={`sidebar-sublink${
                              active ? " active" : ""
                            }`}
                            data-tooltip={item.label}
                            onClick={closeMobile}
                          >
                            <SubIcon className="sidebar-sublink-icon" />
                            <span className="sidebar-sublink-text">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer Account Card */}
        <div className="sidebar-footer">
          <div className="sidebar-account-card">
            <div className="sidebar-avatar">{userInitial}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-email">{userEmail}</div>
            </div>
            <button
              type="button"
              className="sidebar-logout-icon-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
