// src/components/TopNav.js
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthProvider";

export default function TopNav() {
  const navigate = useNavigate();
  const { token, user, logout } = useAuth();

  // not signed in -> minimal nav
  if (!token) {
    return (
      <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
        <div className="container">
          <Link className="navbar-brand fw-bold" to="/">
            Cookeaze Admin
          </Link>
          <div className="d-flex ms-auto">
            <Link className="btn btn-primary btn-sm" to="/">
              Sign in
            </Link>
          </div>
        </div>
      </nav>
    );
  }

  // signed in -> full nav
  return (
    <nav className="navbar navbar-expand-lg navbar-light bg-white shadow-sm">
      <div className="container">
        <Link className="navbar-brand fw-bold" to="/home">
          Cookeaze Admin
        </Link>

        <button
          className="navbar-toggler"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#topnav"
          aria-controls="topnav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon"></span>
        </button>

        <div className="collapse navbar-collapse" id="topnav">
          <ul className="navbar-nav me-auto mb-2 mb-lg-0">
            <li className="nav-item">
              <Link className="nav-link" to="/home">
                Home
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/recipe">
                Recipes
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/recipe-theme">
                Recipe themes dashboard
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/create-recipe">
                Create Recipe
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/adverts">
                Adverts
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/adverts/create">
                Create Advert
              </Link>
            </li>
            <li className="nav-item">
              <Link className="nav-link" to="/categories">
                Categories
              </Link>
            </li>
            {/* <li className="nav-item">
              <Link className="nav-link" to="/feed">
                Feed
              </Link>
            </li> */}
            <li className="nav-item">
              <Link className="nav-link" to="/feed-admin">
                Feed Admin
              </Link>
            </li>

            {user && (user.role === "admin" || user.role === "superAdmin") && (
              <li className="nav-item dropdown">
                <Link
                  className="nav-link dropdown-toggle"
                  to="#"
                  id="adminDropdown"
                  role="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                >
                  Admin
                </Link>
                <ul className="dropdown-menu" aria-labelledby="adminDropdown">
                  <li>
                    <Link className="dropdown-item" to="/admin">
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/users">
                      Manage Users
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/change-role">
                      Change Role
                    </Link>
                  </li>
                  <li>
                    <Link className="dropdown-item" to="/change-password">
                      Change Password
                    </Link>
                  </li>
                </ul>
              </li>
            )}
          </ul>

          <div className="d-flex align-items-center gap-3">
            <div className="text-end me-2 d-none d-md-block">
              <div className="small text-muted">Signed in as</div>
              <div className="fw-semibold">
                {user?.first_name ?? user?.email ?? "You"}
              </div>
            </div>

            <button
              onClick={() => {
                logout();
                navigate("/", { replace: true });
              }}
              className="btn btn-outline-danger btn-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
