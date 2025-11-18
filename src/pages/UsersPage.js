// src/pages/UsersPage.js
import React, { useEffect, useState } from "react";
import axios from "axios";

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
    <div className="container py-4">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
        <h3 className="fw-bold mb-0">Users Management</h3>

        <div className="d-flex gap-2 align-items-center">
          <input
            type="text"
            placeholder="Search by name or email..."
            className="form-control form-control-sm"
            style={{ width: 260 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="form-select form-select-sm"
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
        <div className="alert alert-info py-2 small text-center">{message}</div>
      )}

      <div className="table-responsive shadow-sm rounded bg-white">
        <table className="table table-hover align-middle mb-0">
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>Profile</th>
              <th>Name</th>
              <th>Email</th>
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
                <td colSpan="9" className="text-center py-4">
                  <div className="spinner-border text-primary" role="status" />
                </td>
              </tr>
            ) : currentUsers.length > 0 ? (
              currentUsers.map((u) => (
                <tr key={u.id}>
                  <td className="text-muted">{u.id}</td>
                  <td>
                    <img
                      src={u.profile_picture_url}
                      alt={u.first_name}
                      className="rounded-circle"
                      style={{ width: 45, height: 45, objectFit: "cover" }}
                    />
                  </td>
                  <td className="fw-semibold">
                    {u.first_name} {u.last_name}
                  </td>
                  <td
                    style={{
                      maxWidth: 220,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {u.email}
                  </td>
                  <td>{u.country || "-"}</td>
                  <td>
                    <span
                      className={`badge ${
                        u.role === "superAdmin"
                          ? "bg-danger"
                          : u.role === "admin"
                          ? "bg-warning text-dark"
                          : "bg-secondary"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>

                  <td>
                    <div className="d-flex gap-1 align-items-center">
                      <select
                        className="form-select form-select-sm"
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
                        <option value="superAdmin">superAdmin</option>
                        <option value="admin">admin</option>
                        <option value="user">user</option>
                      </select>

                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleRoleChange(u.id)}
                        disabled={!!roleLoading[u.id]}
                        title="Update role"
                      >
                        {roleLoading[u.id] ? (
                          <span className="spinner-border spinner-border-sm" />
                        ) : (
                          "Update"
                        )}
                      </button>
                    </div>
                  </td>

                  <td>
                    <input
                      type="password"
                      placeholder="New"
                      className="form-control form-control-sm mb-1"
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
                      placeholder="Confirm"
                      className="form-control form-control-sm mb-1"
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
                    <button
                      className="btn btn-sm btn-outline-primary w-100"
                      onClick={() => handlePasswordChange(u.id)}
                      disabled={!!pwdLoading[u.id]}
                    >
                      {pwdLoading[u.id] ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        "Change"
                      )}
                    </button>
                  </td>

                  <td>{u.is_active ? "✅" : "❌"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="text-center text-muted py-3">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav
          className="d-flex justify-content-center mt-3"
          aria-label="Users pagination"
        >
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
              <button
                className="page-link"
                onClick={() => goToPage(currentPage - 1)}
              >
                Prev
              </button>
            </li>

            {[...Array(totalPages).keys()].map((n) => (
              <li
                key={n}
                className={`page-item ${currentPage === n + 1 ? "active" : ""}`}
              >
                <button className="page-link" onClick={() => goToPage(n + 1)}>
                  {n + 1}
                </button>
              </li>
            ))}

            <li
              className={`page-item ${
                currentPage === totalPages ? "disabled" : ""
              }`}
            >
              <button
                className="page-link"
                onClick={() => goToPage(currentPage + 1)}
              >
                Next
              </button>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
