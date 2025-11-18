import React, { useState } from "react";
import { getAxiosInstance } from "../api";

export default function ChangePasswordPage() {
  const [userId, setUserId] = useState("");
  const [form, setForm] = useState({
    old_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await getAxiosInstance.post(
        `/users/${userId}/change-password/`,
        form
      );
      setMessage(res.data.message || "Password changed successfully!");
    } catch (err) {
      setMessage("Error: " + err.response?.data?.message || err.message);
    }
  };

  return (
    <div className="container">
      <h2 className="mb-3">Change Password</h2>
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
        {["old_password", "new_password", "confirm_new_password"].map(
          (field) => (
            <div className="mb-3" key={field}>
              <label className="form-label">{field.replaceAll("_", " ")}</label>
              <input
                type="password"
                className="form-control"
                value={form[field]}
                onChange={(e) => setForm({ ...form, [field]: e.target.value })}
              />
            </div>
          )
        )}
        <button className="btn btn-primary">Submit</button>
        {message && <p className="mt-3 alert alert-info">{message}</p>}
      </form>
    </div>
  );
}
