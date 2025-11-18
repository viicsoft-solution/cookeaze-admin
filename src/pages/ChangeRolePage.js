import React, { useState } from "react";
import { getAxiosInstance } from "../api";

export default function ChangeRolePage() {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await getAxiosInstance.put(`/users/${userId}/change-role/`, {
        role,
      });
      setMessage(res.data.message || "Role updated successfully!");
    } catch (err) {
      setMessage("Error: " + err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="container">
      <h2 className="mb-3">Change User Role</h2>
      <form onSubmit={handleSubmit} className="w-50">
        <div className="mb-3">
          <label className="form-label">User ID</label>
          <input
            type="number"
            className="form-control"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Role</label>
          <select
            className="form-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="">Select role</option>
            <option value="superAdmin">Super Admin</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>
        </div>
        <button className="btn btn-success">Update Role</button>
        {message && <p className="mt-3 alert alert-info">{message}</p>}
      </form>
    </div>
  );
}
