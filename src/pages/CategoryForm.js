import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import { normalizeFoodImage, deduplicateGalleryItems } from "./Imagelibrary";
import "./Categories.css";

const CLOUD_NAME = "djlc333s2";
const UPLOAD_PRESET = "food-admin";
const CATALOG_CACHE_KEY = "cookeaze_recipes_catalog_v5";

export default function CategoryForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const api = useMemo(() => getAxiosInstance(), []);

  const [categoryName, setCategoryName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [error, setError] = useState(null);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    api
      .get(`/categories/${id}/`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setCategoryName(data?.category_name || data?.name || "");
        setImageUrl(data?.image_url || "");
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Failed to load category.");
      })
      .finally(() => setLoading(false));
  }, [api, id, isEdit]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", UPLOAD_PRESET);

      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        formData
      );
      if (res.data?.secure_url) {
        setImageUrl(res.data.secure_url);
      }
    } catch {
      setError("Failed to upload image. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const openLibraryPicker = async () => {
    setLibraryOpen(true);
    if (libraryItems.length > 0) return;
    setLibraryLoading(true);
    try {
      const res = await api.get("/food-images/?page_size=100");
      const raw =
        res.data?.results ||
        res.data?.data ||
        (Array.isArray(res.data) ? res.data : []);
      const normalized = deduplicateGalleryItems(
        raw.map(normalizeFoodImage).filter((item) => item.imageUrl)
      );
      setLibraryItems(normalized);
    } catch {
      setError("Could not load image library.");
    } finally {
      setLibraryLoading(false);
    }
  };

  const filteredLibraryItems = useMemo(() => {
    const q = libraryQuery.trim().toLowerCase();
    if (!q) return libraryItems;
    return libraryItems.filter(
      (item) =>
        item.title?.toLowerCase().includes(q) ||
        (Array.isArray(item.tags) &&
          item.tags.some((t) => String(t).toLowerCase().includes(q)))
    );
  }, [libraryItems, libraryQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = categoryName.trim();
    if (!trimmed) {
      setError("Category name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        category_name: trimmed,
        image_url: imageUrl.trim() || "",
      };

      if (isEdit) {
        await api.put(`/categories/${id}/`, payload);
      } else {
        await api.post("/categories/", payload);
      }

      try {
        sessionStorage.removeItem(CATALOG_CACHE_KEY);
      } catch {
        // ignore
      }

      navigate("/categories");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save category.");
    } finally {
      setSaving(false);
    }
  };

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
            {isEdit ? "Edit Category" : "Create New Category"}
          </h1>
          <p className="cat-subtitle">
            Configure the category title and cover photo displayed across Cookeaze.
          </p>
        </div>
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
              style={{ width: 180, height: 20, marginBottom: 8 }}
            />
            <div
              className="cat-shimmer"
              style={{ width: 280, height: 13, marginBottom: 20 }}
            />
            <div className="cat-field">
              <div
                className="cat-shimmer"
                style={{ width: 110, height: 13, marginBottom: 6 }}
              />
              <div
                className="cat-shimmer"
                style={{ width: "100%", height: 40 }}
              />
            </div>
            <div className="cat-field">
              <div
                className="cat-shimmer"
                style={{ width: 120, height: 13, marginBottom: 6 }}
              />
              <div
                className="cat-shimmer"
                style={{ width: "100%", height: 40 }}
              />
            </div>
            <div
              className="cat-shimmer"
              style={{ width: "100%", height: 68, borderRadius: 11 }}
            />
          </div>
          <div className="cat-panel">
            <div
              className="cat-shimmer"
              style={{ width: 140, height: 18, marginBottom: 8 }}
            />
            <div
              className="cat-shimmer"
              style={{ width: 210, height: 13, marginBottom: 18 }}
            />
            <div
              className="cat-shimmer"
              style={{ width: "100%", height: 195, borderRadius: 12 }}
            />
          </div>
        </div>
      ) : (
        <form className="cat-panel-grid" onSubmit={handleSubmit}>
          <div className="cat-panel">
            <h2 className="cat-panel-title">Category Information</h2>
            <p className="cat-panel-sub">
              Provide a concise, recognizable category name and cover image.
            </p>

            <div className="cat-field">
              <label className="cat-label">Category Name *</label>
              <input
                type="text"
                className="cat-input"
                placeholder="e.g. Nigerian Soups, Quick Breakfast, Desserts..."
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
              />
            </div>

            <div className="cat-field">
              <label className="cat-label">Cover Image URL</label>
              <input
                type="url"
                className="cat-input"
                placeholder="Paste image URL or upload below..."
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
              />
            </div>

            <div className="cat-upload-zone">
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#0f172a" }}>
                  Category Cover Artwork
                </div>
                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  Upload from your device or choose from the Cookeaze Image Library.
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <label
                  className="cat-btn cat-btn-soft cat-btn-sm"
                  style={{ cursor: "pointer", margin: 0 }}
                >
                  <Upload size={14} />
                  {uploading ? "Uploading..." : "Upload File"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    disabled={uploading}
                    style={{ display: "none" }}
                  />
                </label>

                <button
                  type="button"
                  className="cat-btn cat-btn-secondary cat-btn-sm"
                  onClick={openLibraryPicker}
                >
                  <ImageIcon size={14} />
                  Choose from Library
                </button>
              </div>
            </div>

            <div
              style={{
                marginTop: 20,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <Link to="/categories" className="cat-btn cat-btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="cat-btn cat-btn-primary"
                disabled={saving || uploading}
              >
                <CheckCircle2 size={15} />
                {saving
                  ? "Saving..."
                  : isEdit
                  ? "Update Category"
                  : "Create Category"}
              </button>
            </div>
          </div>

          {/* Right Live Preview Card */}
          <div className="cat-panel">
            <h2 className="cat-panel-title">Live Card Preview</h2>
            <p className="cat-panel-sub">How this category appears in the directory</p>

            <div className="cat-card" style={{ pointerEvents: "none" }}>
              <div className="cat-card-top">
                <div className="cat-card-thumb-wrap">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={categoryName || "Preview"}
                      className="cat-card-thumb"
                    />
                  ) : (
                    <div className="cat-card-thumb-placeholder">
                      <ImageIcon size={20} />
                    </div>
                  )}
                </div>
                <div className="cat-card-info">
                  <h3 className="cat-card-title">
                    {categoryName.trim() || "Untitled Category"}
                  </h3>
                  <div className="cat-card-meta">
                    <span className="cat-card-status-dot" />
                    <span>Active category</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {libraryOpen && (
        <div
          className="cat-modal-backdrop"
          onClick={() => setLibraryOpen(false)}
        >
          <div
            className="cat-modal-card wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cat-modal-header">
              <h3>Choose Category Cover from Library</h3>
              <button
                type="button"
                className="cat-modal-close"
                onClick={() => setLibraryOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cat-modal-body">
              <input
                type="text"
                className="cat-input"
                placeholder="Search food images by name or tag..."
                value={libraryQuery}
                onChange={(e) => setLibraryQuery(e.target.value)}
              />

              {libraryLoading ? (
                <div className="cat-empty" style={{ marginTop: 12 }}>
                  <p>Loading food image library...</p>
                </div>
              ) : filteredLibraryItems.length === 0 ? (
                <div className="cat-empty" style={{ marginTop: 12 }}>
                  <p>No matching images found in library.</p>
                </div>
              ) : (
                <div className="cat-lib-grid">
                  {filteredLibraryItems.map((item) => (
                    <button
                      type="button"
                      key={item.id || item.imageUrl}
                      className="cat-lib-item"
                      onClick={() => {
                        setImageUrl(item.imageUrl);
                        setLibraryOpen(false);
                      }}
                    >
                      <img src={item.imageUrl} alt={item.title || "Food"} />
                      <span>{item.title || "Food Image"}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
