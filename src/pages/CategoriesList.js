import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Search,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  Eye,
  Upload,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  AlertCircle,
  X,
  Tag,
  BookOpen,
  FolderKanban,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import { normalizeFoodImage, deduplicateGalleryItems } from "./Imagelibrary";
import "./Categories.css";

const CLOUD_NAME = "djlc333s2";
const UPLOAD_PRESET = "food-admin";
const CATALOG_CACHE_KEY = "cookeaze_recipes_catalog_v5";

export default function CategoriesList() {
  const api = useMemo(() => getAxiosInstance(), []);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("name_asc");
  const [viewMode, setViewMode] = useState("grid");
  const [toast, setToast] = useState(null);

  // Recipe count lookup per category name (normalized lowercase)
  const [recipeCounts, setRecipeCounts] = useState({});

  // Create / Edit Modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formName, setFormName] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  // Quick card upload state
  const [quickUploadingId, setQuickUploadingId] = useState(null);
  const quickFileInputRef = useRef(null);
  const quickTargetCatRef = useRef(null);

  // Image Library Picker state
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Compute recipe counts per category from cached catalog if present
  const loadRecipeCounts = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const list = Array.isArray(parsed?.items) ? parsed.items : [];
      const counts = {};
      list.forEach((recipe) => {
        const cats = Array.isArray(recipe.categories) ? recipe.categories : [];
        cats.forEach((c) => {
          const label =
            typeof c === "string"
              ? c.trim()
              : String(c?.category_name || c?.name || "").trim();
          if (!label) return;
          const key = label.toLowerCase();
          counts[key] = (counts[key] || 0) + 1;
        });
      });
      setRecipeCounts(counts);
    } catch {
      // Ignore storage parse issues
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/categories/");
      const items = res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
      setCategories(Array.isArray(items) ? items : []);
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to load categories."
      );
    } finally {
      setLoading(false);
    }
  }, [api, showToast]);

  useEffect(() => {
    fetchCategories();
    loadRecipeCounts();
  }, [fetchCategories, loadRecipeCounts]);

  const invalidateRecipeCatalogCache = () => {
    try {
      sessionStorage.removeItem(CATALOG_CACHE_KEY);
    } catch {
      // ignore
    }
  };

  // Enrich & filter categories
  const processedCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = categories
      .map((cat) => {
        const name = String(cat.category_name || cat.name || "").trim();
        const count = recipeCounts[name.toLowerCase()] || 0;
        return {
          ...cat,
          displayName: name || "Untitled Category",
          recipeCount: count,
        };
      })
      .filter((cat) => {
        if (!q) return true;
        return cat.displayName.toLowerCase().includes(q);
      });

    list.sort((a, b) => {
      if (sortBy === "name_desc") {
        return b.displayName.localeCompare(a.displayName);
      }
      if (sortBy === "recipes_desc") {
        return b.recipeCount - a.recipeCount || a.displayName.localeCompare(b.displayName);
      }
      if (sortBy === "with_image") {
        return Number(Boolean(b.image_url)) - Number(Boolean(a.image_url));
      }
      return a.displayName.localeCompare(b.displayName);
    });

    return list;
  }, [categories, recipeCounts, search, sortBy]);

  // KPI metrics
  const kpis = useMemo(() => {
    const total = categories.length;
    const withCover = categories.filter((c) => Boolean(c.image_url)).length;
    const linkedRecipes = Object.values(recipeCounts).reduce((acc, v) => acc + v, 0);
    return { total, withCover, linkedRecipes };
  }, [categories, recipeCounts]);

  // Open Create or Edit modal
  const openCreateModal = () => {
    setEditingCategory(null);
    setFormName("");
    setFormImageUrl("");
    setEditorOpen(true);
  };

  const openEditModal = (cat) => {
    setEditingCategory(cat);
    setFormName(cat.category_name || cat.name || "");
    setFormImageUrl(cat.image_url || "");
    setEditorOpen(true);
  };

  const closeEditorModal = () => {
    if (saving || uploadingCover) return;
    setEditorOpen(false);
    setEditingCategory(null);
  };

  // Upload image to Cloudinary inside modal
  const handleModalFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        fd
      );
      if (res.data?.secure_url) {
        setFormImageUrl(res.data.secure_url);
        showToast("success", "Cover image uploaded.");
      }
    } catch {
      showToast("error", "Image upload failed. Please try again.");
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  // Save Category (Create or Update)
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      showToast("error", "Category name is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        category_name: trimmedName,
        image_url: formImageUrl.trim() || "",
      };

      if (editingCategory?.id) {
        await api.put(`/categories/${editingCategory.id}/`, payload);
        showToast("success", `Updated "${trimmedName}".`);
      } else {
        await api.post("/categories/", payload);
        showToast("success", `Created category "${trimmedName}".`);
      }

      invalidateRecipeCatalogCache();
      setEditorOpen(false);
      setEditingCategory(null);
      await fetchCategories();
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to save category."
      );
    } finally {
      setSaving(false);
    }
  };

  // Quick 1-click cover upload from card
  const triggerQuickCardUpload = (cat) => {
    quickTargetCatRef.current = cat;
    if (quickFileInputRef.current) {
      quickFileInputRef.current.value = "";
      quickFileInputRef.current.click();
    }
  };

  const handleQuickCardFileChange = async (e) => {
    const file = e.target.files?.[0];
    const targetCat = quickTargetCatRef.current;
    if (!file || !targetCat) return;

    setQuickUploadingId(targetCat.id);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", UPLOAD_PRESET);
      const uploadRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        fd
      );
      const imageUrl = uploadRes.data?.secure_url;
      if (!imageUrl) throw new Error("No URL returned");

      await api.put(`/categories/${targetCat.id}/`, {
        category_name: targetCat.category_name || targetCat.displayName,
        image_url: imageUrl,
      });

      setCategories((prev) =>
        prev.map((c) => (c.id === targetCat.id ? { ...c, image_url: imageUrl } : c))
      );
      showToast(
        "success",
        `Updated cover photo for "${targetCat.category_name || targetCat.displayName}".`
      );
    } catch {
      showToast("error", "Failed to update cover photo.");
    } finally {
      setQuickUploadingId(null);
      quickTargetCatRef.current = null;
    }
  };

  // Open Image Library Picker
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
      showToast("error", "Could not load image library.");
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

  // Confirm Delete Category
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/categories/${deleteTarget.id}/`);
      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      invalidateRecipeCatalogCache();
      showToast(
        "success",
        `Deleted category "${deleteTarget.displayName || deleteTarget.category_name}".`
      );
      setDeleteTarget(null);
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to delete category."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cat-page">
      {/* Hidden input for 1-click card cover upload */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleQuickCardFileChange}
      />

      {/* Page Header */}
      <div className="cat-header">
        <div className="cat-header-left">
          <h1 className="cat-title">Recipe Categories</h1>
          <p className="cat-subtitle">
            Organize recipes into clear culinary categories, manage cover imagery, and control app discovery.
          </p>
        </div>

        <div className="cat-header-actions">
          <button
            type="button"
            className="cat-btn cat-btn-secondary"
            onClick={fetchCategories}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            className="cat-btn cat-btn-primary"
            onClick={openCreateModal}
          >
            <Plus size={16} />
            New Category
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div className={`cat-toast ${toast.type}`}>
          <div className="cat-toast-left">
            {toast.type === "error" ? (
              <AlertCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="cat-toast-close"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI Summary Strip */}
      <div className="cat-kpi-grid">
        <div className="cat-kpi-card">
          <div className="cat-kpi-meta">
            <span className="cat-kpi-label">Total Categories</span>
            {loading ? (
              <div
                className="cat-shimmer"
                style={{ width: 64, height: 26, margin: "2px 0" }}
              />
            ) : (
              <span className="cat-kpi-value">{kpis.total}</span>
            )}
            <span className="cat-kpi-sub">Active taxonomy groups</span>
          </div>
          <div className="cat-kpi-icon">
            <FolderKanban size={20} />
          </div>
        </div>

        <div className="cat-kpi-card">
          <div className="cat-kpi-meta">
            <span className="cat-kpi-label">With Cover Artwork</span>
            {loading ? (
              <div
                className="cat-shimmer"
                style={{ width: 88, height: 26, margin: "2px 0" }}
              />
            ) : (
              <span className="cat-kpi-value">
                {kpis.withCover} / {kpis.total}
              </span>
            )}
            <span className="cat-kpi-sub">Ready for mobile carousels</span>
          </div>
          <div className="cat-kpi-icon">
            <ImageIcon size={20} />
          </div>
        </div>

        <div className="cat-kpi-card">
          <div className="cat-kpi-meta">
            <span className="cat-kpi-label">
              {kpis.linkedRecipes > 0
                ? "Categorized Assignments"
                : "Cover Completion"}
            </span>
            {loading ? (
              <div
                className="cat-shimmer"
                style={{ width: 76, height: 26, margin: "2px 0" }}
              />
            ) : (
              <span className="cat-kpi-value">
                {kpis.linkedRecipes > 0
                  ? kpis.linkedRecipes.toLocaleString()
                  : kpis.total > 0
                  ? `${Math.round((kpis.withCover / kpis.total) * 100)}%`
                  : "0%"}
              </span>
            )}
            <span className="cat-kpi-sub">
              {kpis.linkedRecipes > 0
                ? "Recipe-to-category links"
                : `${kpis.total - kpis.withCover} missing cover artwork`}
            </span>
          </div>
          <div className="cat-kpi-icon">
            <BookOpen size={20} />
          </div>
        </div>
      </div>

      {/* Search, Sort & View Toolbar */}
      <div className="cat-toolbar">
        <div className="cat-toolbar-left">
          <div className="cat-search-box">
            <Search size={15} className="cat-search-icon" />
            <input
              type="text"
              className="cat-search-input"
              placeholder="Search category by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="cat-search-clear"
                onClick={() => setSearch("")}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="cat-toolbar-right">
          <select
            className="cat-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="name_asc">Sort: Name (A–Z)</option>
            <option value="name_desc">Sort: Name (Z–A)</option>
            <option value="recipes_desc">Sort: Most Recipes</option>
            <option value="with_image">Sort: Cover Image First</option>
          </select>

          <div className="cat-view-switch">
            <button
              type="button"
              className={`cat-view-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid size={14} />
              Grid
            </button>
            <button
              type="button"
              className={`cat-view-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              <ListIcon size={14} />
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="cat-grid">
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className="cat-card">
                <div className="cat-card-top">
                  <div
                    className="cat-shimmer"
                    style={{ width: 52, height: 52, borderRadius: 11, flexShrink: 0 }}
                  />
                  <div className="cat-card-info">
                    <div
                      className="cat-shimmer"
                      style={{ width: "68%", height: 16 }}
                    />
                    <div
                      className="cat-shimmer"
                      style={{ width: "45%", height: 12, marginTop: 4 }}
                    />
                  </div>
                </div>
                <div className="cat-card-actions">
                  <div className="cat-card-actions-left">
                    <div
                      className="cat-shimmer"
                      style={{ width: 64, height: 30 }}
                    />
                    <div
                      className="cat-shimmer"
                      style={{ width: 68, height: 30 }}
                    />
                  </div>
                  <div
                    className="cat-shimmer"
                    style={{ width: 32, height: 30 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cat-table-card">
            <div className="cat-table-wrap">
              <table className="cat-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Cover Status</th>
                    <th>Linked Recipes</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="cat-table-cell-main">
                          <div
                            className="cat-shimmer"
                            style={{ width: 46, height: 46, borderRadius: 9 }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            <div
                              className="cat-shimmer"
                              style={{ width: 140, height: 15 }}
                            />
                            <div
                              className="cat-shimmer"
                              style={{ width: 90, height: 12 }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div
                          className="cat-shimmer"
                          style={{ width: 110, height: 24, borderRadius: 999 }}
                        />
                      </td>
                      <td>
                        <div
                          className="cat-shimmer"
                          style={{ width: 72, height: 16 }}
                        />
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "flex-end",
                            gap: 8,
                          }}
                        >
                          <div
                            className="cat-shimmer"
                            style={{ width: 58, height: 30 }}
                          />
                          <div
                            className="cat-shimmer"
                            style={{ width: 58, height: 30 }}
                          />
                          <div
                            className="cat-shimmer"
                            style={{ width: 32, height: 30 }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : processedCategories.length === 0 ? (
        <div className="cat-empty">
          <Tag size={28} style={{ color: "#94a3b8" }} />
          <h4>No categories found</h4>
          <p>
            {search
              ? `No category matches "${search}". Try clearing your search filter.`
              : "Get started by creating your first recipe category."}
          </p>
          {search ? (
            <button
              type="button"
              className="cat-btn cat-btn-secondary"
              onClick={() => setSearch("")}
            >
              Clear Search
            </button>
          ) : (
            <button
              type="button"
              className="cat-btn cat-btn-primary"
              onClick={openCreateModal}
            >
              <Plus size={15} />
              Create First Category
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="cat-grid">
          {processedCategories.map((cat) => (
            <div key={cat.id} className="cat-card">
              <div className="cat-card-top">
                <div className="cat-card-thumb-wrap">
                  {cat.image_url ? (
                    <img src={cat.image_url} alt={cat.displayName} />
                  ) : (
                    <Tag size={20} />
                  )}

                  <button
                    type="button"
                    className="cat-card-thumb-upload"
                    title="Quick change cover thumbnail"
                    onClick={() => triggerQuickCardUpload(cat)}
                    disabled={quickUploadingId === cat.id}
                  >
                    <Upload size={14} />
                  </button>
                </div>

                <div className="cat-card-info">
                  <h3 className="cat-card-title">{cat.displayName}</h3>
                  <div className="cat-card-meta">
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <span
                        className={`cat-card-dot ${
                          cat.image_url ? "" : "missing"
                        }`}
                      />
                      {cat.image_url ? "Active Category" : "No Cover Icon"}
                    </span>
                    {cat.recipeCount > 0 && (
                      <span>
                        · <strong>{cat.recipeCount}</strong>{" "}
                        {cat.recipeCount === 1 ? "recipe" : "recipes"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="cat-card-actions">
                <div className="cat-card-actions-left">
                  <button
                    type="button"
                    className="cat-btn cat-btn-secondary cat-btn-sm"
                    onClick={() => openEditModal(cat)}
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>
                  <Link
                    to={`/categories/${cat.id}`}
                    className="cat-btn cat-btn-secondary cat-btn-sm"
                    title="View category details"
                  >
                    <Eye size={13} />
                    Details
                  </Link>
                </div>

                <button
                  type="button"
                  className="cat-btn cat-btn-danger-ghost cat-btn-sm"
                  onClick={() => setDeleteTarget(cat)}
                  title="Delete category"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="cat-table-card">
          <div className="cat-table-wrap">
            <table className="cat-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Cover Status</th>
                  <th>Linked Recipes</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {processedCategories.map((cat) => (
                  <tr key={cat.id}>
                    <td>
                      <div className="cat-table-cell-main">
                        {cat.image_url ? (
                          <img
                            src={cat.image_url}
                            alt={cat.displayName}
                            className="cat-table-thumb"
                          />
                        ) : (
                          <div className="cat-table-thumb">
                            <ImageIcon size={18} />
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {cat.displayName}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                            ID: {String(cat.id).slice(0, 12)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {cat.image_url ? (
                        <span className="cat-status-pill ready">
                          <CheckCircle2 size={12} />
                          Cover Uploaded
                        </span>
                      ) : (
                        <span className="cat-status-pill missing">
                          <AlertCircle size={12} />
                          Missing Cover
                        </span>
                      )}
                    </td>
                    <td>
                      <strong>{cat.recipeCount}</strong> recipes
                    </td>
                    <td>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "flex-end",
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          className="cat-btn cat-btn-secondary cat-btn-sm"
                          onClick={() => openEditModal(cat)}
                        >
                          <Edit3 size={13} />
                          Edit
                        </button>
                        <Link
                          to={`/categories/${cat.id}`}
                          className="cat-btn cat-btn-secondary cat-btn-sm"
                        >
                          <Eye size={13} />
                          View
                        </Link>
                        <button
                          type="button"
                          className="cat-btn cat-btn-danger-ghost cat-btn-sm"
                          onClick={() => setDeleteTarget(cat)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Category Modal */}
      {editorOpen && (
        <div className="cat-modal-backdrop" onClick={closeEditorModal}>
          <div
            className="cat-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cat-modal-header">
              <h3>
                {editingCategory ? "Edit Category" : "Create New Category"}
              </h3>
              <button
                type="button"
                className="cat-modal-close"
                onClick={closeEditorModal}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="cat-modal-body">
                <div className="cat-field">
                  <label className="cat-label">Category Name *</label>
                  <input
                    type="text"
                    className="cat-input"
                    placeholder="e.g. Nigerian Soups, Quick Breakfast, Vegan..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="cat-field" style={{ marginBottom: 0 }}>
                  <label className="cat-label">Cover Image</label>
                  <div className="cat-preview-box">
                    {formImageUrl ? (
                      <img src={formImageUrl} alt="Category preview" />
                    ) : (
                      <div className="cat-card-placeholder">
                        <ImageIcon size={26} />
                        <span>No cover image selected</span>
                      </div>
                    )}
                  </div>

                  <input
                    type="url"
                    className="cat-input"
                    placeholder="Paste image URL or upload below..."
                    value={formImageUrl}
                    onChange={(e) => setFormImageUrl(e.target.value)}
                    style={{ marginBottom: 10 }}
                  />

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <label
                      className="cat-btn cat-btn-soft cat-btn-sm"
                      style={{ cursor: "pointer", margin: 0 }}
                    >
                      <Upload size={14} />
                      {uploadingCover ? "Uploading..." : "Upload Image"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleModalFileUpload}
                        disabled={uploadingCover}
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

                    {formImageUrl && (
                      <button
                        type="button"
                        className="cat-btn cat-btn-danger-ghost cat-btn-sm"
                        onClick={() => setFormImageUrl("")}
                      >
                        Remove Cover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="cat-modal-footer">
                <button
                  type="button"
                  className="cat-btn cat-btn-secondary"
                  onClick={closeEditorModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cat-btn cat-btn-primary"
                  disabled={saving || uploadingCover}
                >
                  {saving
                    ? "Saving..."
                    : editingCategory
                    ? "Save Changes"
                    : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Choose from Image Library Modal */}
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
                <div className="cat-lib-grid">
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="cat-lib-item"
                      style={{ pointerEvents: "none" }}
                    >
                      <div
                        className="cat-shimmer"
                        style={{ width: "100%", height: 92, borderRadius: 0 }}
                      />
                      <div style={{ padding: 7 }}>
                        <div
                          className="cat-shimmer"
                          style={{ width: "75%", height: 12 }}
                        />
                      </div>
                    </div>
                  ))}
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
                        setFormImageUrl(item.imageUrl);
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

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="cat-modal-backdrop"
          onClick={() => !deleting && setDeleteTarget(null)}
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
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cat-modal-body">
              <p style={{ margin: "0 0 8px 0", fontSize: "0.9rem", color: "#334155" }}>
                Are you sure you want to delete{" "}
                <strong>
                  {deleteTarget.displayName || deleteTarget.category_name}
                </strong>
                ?
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b" }}>
                This category will be removed from the directory immediately.
              </p>
            </div>
            <div className="cat-modal-footer">
              <button
                type="button"
                className="cat-btn cat-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cat-btn cat-btn-danger"
                onClick={handleConfirmDelete}
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
