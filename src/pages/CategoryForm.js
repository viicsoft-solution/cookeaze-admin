// src/pages/CategoryForm.js
import React, { useEffect, useState } from "react";
import { getAxiosInstance } from "../api";
import { useNavigate, useParams } from "react-router-dom";

/**
 * Use this component for both create and edit.
 * If params.id exists -> edit mode.
 */
export default function CategoryForm() {
  const axios = getAxiosInstance();
  const navigate = useNavigate();
  const { id } = useParams(); // undefined when creating
  const isEdit = Boolean(id);

  const [category, setCategory] = useState({
    category_name: "",
    image_url: "",
  });
  const [loading, setLoading] = useState(isEdit);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!isEdit) return;
    (async () => {
      setLoading(true);
      try {
        const res = await axios.get(`/categories/${id}/`);
        setCategory(res.data?.data ?? {});
      } catch (err) {
        console.error(err);
        setStatus({ type: "danger", text: "Failed to load category." });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line
  }, [id]);

  const isValidUrl = (s) => {
    if (!s) return true; // allow empty
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);

    if (!category.category_name || category.category_name.trim() === "") {
      setStatus({ type: "danger", text: "Category name is required." });
      return;
    }
    if (!isValidUrl(category.image_url)) {
      setStatus({ type: "danger", text: "Image URL is not valid." });
      return;
    }

    try {
      if (isEdit) {
        await axios.put(`/categories/${id}/`, category);
        setStatus({ type: "success", text: "Category updated." });
        navigate(`/categories/${id}`);
      } else {
        await axios.post("/categories/", category);
        setStatus({ type: "success", text: "Category created." });
        navigate("/categories");
      }
    } catch (err) {
      console.error(err);
      // try to display server validation errors if present
      const resp = err?.response?.data;
      const msg =
        resp?.message || (resp?.data ? JSON.stringify(resp.data) : err.message);
      setStatus({ type: "danger", text: `Failed: ${msg}` });
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>{isEdit ? "Edit Category" : "Create Category"}</h3>
      </div>

      {status && (
        <div className={`alert alert-${status.type}`}>{status.text}</div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="card p-4 shadow-sm">
          <div className="mb-3">
            <label className="form-label">Category Name</label>
            <input
              type="text"
              className="form-control"
              value={category.category_name || ""}
              onChange={(e) =>
                setCategory({ ...category, category_name: e.target.value })
              }
              required
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Image URL (optional)</label>
            <input
              type="url"
              className="form-control"
              value={category.image_url || ""}
              onChange={(e) =>
                setCategory({ ...category, image_url: e.target.value })
              }
              placeholder="https://example.com/image.jpg"
            />
            <div className="form-text">
              Leave blank if no image. If provided, must be a valid URL.
            </div>
          </div>

          <div className="d-flex gap-2">
            <button className="btn btn-primary" type="submit">
              {isEdit ? "Save Changes" : "Create"}
            </button>
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
