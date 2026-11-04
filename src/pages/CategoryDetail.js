import React, { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Edit3,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  X,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./Categories.css";

const CATALOG_CACHE_KEY = "cookeaze_recipes_catalog_v5";

export default function CategoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const api = useMemo(() => getAxiosInstance(), []);

  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .get(`/categories/${id}/`)
      .then((res) => {
        setCategory(res.data?.data ?? res.data);
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load category.");
      })
      .finally(() => setLoading(false));
  }, [api, id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/categories/${id}/`);
      try {
        sessionStorage.removeItem(CATALOG_CACHE_KEY);
      } catch {
        // ignore
      }
      navigate("/categories");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete category.");
      setConfirmDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  };

  const displayName =
    category?.category_name || category?.name || "Untitled Category";

  return (
    <div className="cat-page">
      <div className="cat-header">
        <div className="cat-header-left">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link to="/categories" className="cat-btn cat-btn-secondary cat-btn-sm">
              <ArrowLeft size={14} />
              Back to Categories
            </Link>
          </div>
          <h1 className="cat-title" style={{ marginTop: 6 }}>
            {loading ? "Category Details" : displayName}
          </h1>
          <p className="cat-subtitle">
            Inspect category metadata, cover photo status, and quick actions.
          </p>
        </div>

        {category && (
          <div className="cat-header-actions">
            <Link
              to={`/categories/${id}/edit`}
              className="cat-btn cat-btn-secondary"
            >
              <Edit3 size={15} />
              Edit Category
            </Link>
            <button
              type="button"
              className="cat-btn cat-btn-danger-ghost"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              <Trash2 size={15} />
              Delete
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="cat-toast error">
          <div className="cat-toast-left">
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="cat-toast-close"
            onClick={() => setError(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="cat-panel-grid">
          <div className="cat-panel">
            <div
              className="cat-shimmer"
              style={{ width: 140, height: 18, marginBottom: 8 }}
            />
            <div
              className="cat-shimmer"
              style={{ width: 260, height: 13, marginBottom: 18 }}
            />
            <div
              className="cat-shimmer"
              style={{ width: "100%", height: 280, borderRadius: 11 }}
            />
          </div>
          <div className="cat-panel">
            <div
              className="cat-shimmer"
              style={{ width: 150, height: 18, marginBottom: 8 }}
            />
            <div
              className="cat-shimmer"
              style={{ width: 120, height: 13, marginBottom: 22 }}
            />
            {[1, 2, 3].map((n) => (
              <div key={n} className="cat-field">
                <div
                  className="cat-shimmer"
                  style={{ width: 95, height: 12, marginBottom: 6 }}
                />
                <div
                  className="cat-shimmer"
                  style={{ width: "75%", height: 20 }}
                />
              </div>
            ))}
          </div>
        </div>
      ) : !category ? (
        <div className="cat-empty">
          <h4>Category not found</h4>
          <Link to="/categories" className="cat-btn cat-btn-secondary">
            Return to Categories
          </Link>
        </div>
      ) : (
        <div className="cat-panel-grid">
          <div className="cat-panel">
            <h2 className="cat-panel-title">Cover Artwork</h2>
            <p className="cat-panel-sub">
              Primary cover photo displayed in category carousels and filters.
            </p>
            <div className="cat-preview-box" style={{ height: 280 }}>
              {category.image_url ? (
                <img src={category.image_url} alt={displayName} />
              ) : (
                <div className="cat-card-placeholder">
                  <ImageIcon size={30} />
                  <span>No cover image uploaded</span>
                </div>
              )}
            </div>
          </div>

          <div className="cat-panel">
            <h2 className="cat-panel-title">Category Summary</h2>
            <p className="cat-panel-sub">System record details</p>

            <div className="cat-field">
              <span className="cat-label">Category Name</span>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "#0f172a" }}>
                {displayName}
              </div>
            </div>

            <div className="cat-field">
              <span className="cat-label">Category ID</span>
              <div
                style={{
                  fontSize: "0.82rem",
                  color: "#64748b",
                  wordBreak: "break-all",
                }}
              >
                {category.id}
              </div>
            </div>

            <div className="cat-field">
              <span className="cat-label">Cover Status</span>
              <div>
                {category.image_url ? (
                  <span className="cat-status-pill ready">
                    <CheckCircle2 size={13} />
                    Cover Image Active
                  </span>
                ) : (
                  <span className="cat-status-pill missing">
                    <AlertCircle size={13} />
                    Missing Cover Image
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteOpen && (
        <div
          className="cat-modal-backdrop"
          onClick={() => !deleting && setConfirmDeleteOpen(false)}
        >
          <div
            className="cat-modal-card"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cat-modal-header">
              <h3>Delete Category</h3>
              <button
                type="button"
                className="cat-modal-close"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cat-modal-body">
              <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>
                Are you sure you want to permanently delete{" "}
                <strong>{displayName}</strong>?
              </p>
            </div>
            <div className="cat-modal-footer">
              <button
                type="button"
                className="cat-btn cat-btn-secondary"
                onClick={() => setConfirmDeleteOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cat-btn cat-btn-danger"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
