// src/pages/UsersPage.js
import React, { useEffect, useState } from "react";
import axios from "axios";
import "./UsersPage.css";

const API_BASE = "https://api.cookeaze.app/api";

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    Accept: "application/json",
  },
});
// inject token dynamically for every request
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [selectedRole, setSelectedRole] = useState({});
  const [passwords, setPasswords] = useState({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  // per-user loading maps
  const [roleLoading, setRoleLoading] = useState({});
  const [pwdLoading, setPwdLoading] = useState({});

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 8;

  // Fetch users
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    axiosInstance
      .get("/users/")
      .then((res) => {
        const data = res.data?.data || [];
        if (!mounted) return;
        setUsers(data);
        setFilteredUsers(data);
      })
      .catch((err) => {
        console.error(err);
        setMessage(
          "Failed to load users. Check your token/network and refresh the page."
        );
      })
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  // Search and role filter logic
  useEffect(() => {
    const q = (search || "").toLowerCase().trim();
    let filtered = users.filter((u) => {
      const name = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
      const email = (u.email || "").toLowerCase();
      const matchesQuery = !q || name.includes(q) || email.includes(q);
      const matchesRole = !roleFilter || u.role === roleFilter;
      return matchesQuery && matchesRole;
    });
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [search, roleFilter, users]);

  // Pagination logic
  const indexOfLast = currentPage * usersPerPage;
  const indexOfFirst = indexOfLast - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.max(
    1,
    Math.ceil(filteredUsers.length / usersPerPage)
  );

  // Handle role update
  const handleRoleChange = async (id) => {
    const newRole = selectedRole[id];
    if (!newRole) return setMessage("Please select a role before updating.");
    setRoleLoading((s) => ({ ...s, [id]: true }));
    setMessage("");
    try {
      const res = await axiosInstance.put(`/users/${id}/change-role/`, {
        role: newRole,
      });
      setMessage(res.data?.message || "Role updated successfully!");
      // update local cache
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: newRole } : u))
      );
    } catch (err) {
      console.error(err);
      setMessage(
        "Error updating role: " + (err?.response?.data?.message || err.message)
      );
    } finally {
      setRoleLoading((s) => ({ ...s, [id]: false }));
    }
  };

  // Handle password update
  const handlePasswordChange = async (id) => {
    const form = passwords[id] || {};
    if (!form.new_password || !form.confirm_new_password) {
      return setMessage("Please fill both password fields.");
    }
    if (form.new_password !== form.confirm_new_password) {
      return setMessage("New password and confirm password do not match.");
    }

    setPwdLoading((s) => ({ ...s, [id]: true }));
    setMessage("");
    try {
      const res = await axiosInstance.post(`/users/${id}/change-password/`, {
        old_password: form.old_password || "string", // API expects old_password (use fallback if admin forced change)
        new_password: form.new_password,
        confirm_new_password: form.confirm_new_password,
      });
      setMessage(res.data?.message || "Password changed successfully!");
      // clear the inputs for this user
      setPasswords((prev) => ({ ...prev, [id]: {} }));
    } catch (err) {
      console.error(err);
      setMessage(
        "Error changing password: " +
          (err?.response?.data?.message || err.message)
      );
    } finally {
      setPwdLoading((s) => ({ ...s, [id]: false }));
    }
  };

  const goToPage = (p) => {
    if (p < 1 || p > totalPages) return;
    setCurrentPage(p);
    // small UX nicety: scroll to top of table on page change
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="container py-4 users-page-container">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4 users-header">
        <h3 className="users-title mb-0">Users Management</h3>

        <div className="users-controls">
          <input
            type="search"
            autoComplete="off"
            name="prevent_autofill_search"
            placeholder="Search by name or email..."
            className="modern-input"
            style={{ width: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="modern-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            <option value="superAdmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>
      </div>

      {message && (
        <div className="alert alert-info py-2 small text-center rounded shadow-sm">{message}</div>
      )}

      <div className="users-card">
        <div className="users-table-wrapper">
          <table className="users-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>User</th>
                <th>Country</th>
                <th>Role</th>
                <th style={{ minWidth: 160 }}>Change Role</th>
                <th style={{ minWidth: 220 }}>Change Password</th>
                <th>Status</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" />
                  </td>
                </tr>
              ) : currentUsers.length > 0 ? (
                currentUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="text-muted font-monospace small">#{u.id}</td>
                    <td>
                      <div className="profile-cell">
                        <img
                          src={u.profile_picture_url || "https://via.placeholder.com/45"}
                          alt={u.first_name}
                          className="profile-avatar"
                        />
                        <div>
                          <div className="profile-name">{u.first_name} {u.last_name}</div>
                          <div className="profile-email">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.country || "-"}</td>
                    <td>
                      <span className={`role-badge role-${u.role === 'superAdmin' ? 'superAdmin' : u.role === 'admin' ? 'admin' : 'user'}`}>
                        {u.role === 'superAdmin' ? 'Super Admin' : u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>

                  <td>
                    <div className="action-group">
                      <select
                        className="action-select"
                        value={selectedRole[u.id] || ""}
                        onChange={(e) =>
                          setSelectedRole((s) => ({
                            ...s,
                            [u.id]: e.target.value,
                          }))
                        }
                        disabled={!!roleLoading[u.id]}
                      >
                        <option value="">Select</option>
                        <option value="superAdmin">SuperAdmin</option>
                        <option value="admin">Admin</option>
                        <option value="user">User</option>
                      </select>

                      <button
                        className="btn-modern btn-modern-success"
                        onClick={() => handleRoleChange(u.id)}
                        disabled={!!roleLoading[u.id]}
                        title="Update role"
                      >
                        {roleLoading[u.id] ? "..." : "Update"}
                      </button>
                    </div>
                  </td>

                  <td>
                    <div className="action-group">
                      <div className="password-inputs">
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="New Password"
                          value={passwords[u.id]?.new_password || ""}
                          onChange={(e) =>
                            setPasswords((p) => ({
                              ...p,
                              [u.id]: { ...p[u.id], new_password: e.target.value },
                            }))
                          }
                          disabled={!!pwdLoading[u.id]}
                        />
                        <input
                          type="password"
                          autoComplete="new-password"
                          placeholder="Confirm Password"
                          value={passwords[u.id]?.confirm_new_password || ""}
                          onChange={(e) =>
                            setPasswords((p) => ({
                              ...p,
                              [u.id]: {
                                ...p[u.id],
                                confirm_new_password: e.target.value,
                              },
                            }))
                          }
                          disabled={!!pwdLoading[u.id]}
                        />
                      </div>
                      <button
                        className="btn-modern btn-modern-primary"
                        onClick={() => handlePasswordChange(u.id)}
                        disabled={!!pwdLoading[u.id]}
                      >
                        {pwdLoading[u.id] ? "..." : "Change"}
                      </button>
                    </div>
                  </td>

                  <td>
                    <span className={u.is_active ? 'status-active' : 'status-inactive'} title={u.is_active ? "Active" : "Inactive"}>
                      {u.is_active ? "✓" : "✗"}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center text-muted py-5">
                  No users found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="modern-pagination">
          <button
            className="pagination-btn prev-next"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Prev
          </button>

          <span className="text-muted fw-semibold px-3 small">
            Page {currentPage} of {totalPages}
          </span>

          <button
            className="pagination-btn prev-next"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
