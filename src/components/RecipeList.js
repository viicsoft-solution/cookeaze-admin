// src/components/RecipeList.js
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

/**
 * RecipeList with:
 * - server-driven pagination (page, page_size)
 * - filters: search, category, country, min rating (attempted server-side via query params)
 * - client-side filtering fallback
 * - detailed modal with edit/delete and image upload support
 * - EDITABLE CATEGORIES with multiple selection support
 *
 * Small fix: ensure we send `ingredients_data` and `steps_data` (the API expects those keys).
 */

const API_BASE = "https://api.cookeaze.app/api/recipes/";
const CATEGORIES_API = "https://api.cookeaze.app/api/categories/";

const RecipeList = () => {
  // list & pagination
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const [nextUrl, setNextUrl] = useState(null);
  const [previousUrl, setPreviousUrl] = useState(null);

  // UI controls
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [totalPages, setTotalPages] = useState(1);

  // filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [minRating, setMinRating] = useState("");

  // modal / detail
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // categories for editing
  const [availableCategories, setAvailableCategories] = useState([]);

  // image edit
  const [newImageFile, setNewImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // NEW: mode for image editing: 'upload' or 'url'
  const [imageMode, setImageMode] = useState("upload");
  // NEW: input state for pasted URL
  const [imageUrlInput, setImageUrlInput] = useState("");

  // misc
  const [statusMsg, setStatusMsg] = useState(null);
  const token = localStorage.getItem("token");

  const axiosInstance = axios.create({
    headers: {
      accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get(CATEGORIES_API);
        const catArray = res.data?.data || [];
        setAvailableCategories(catArray);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        setAvailableCategories([]);
      }
    };
    fetchCategories();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildUrl = (page = 1, size = pageSize) => {
    const params = new URLSearchParams();
    if (page) params.set("page", page);
    if (size) params.set("page_size", size);
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    if (countryFilter) params.set("country", countryFilter);
    if (minRating) params.set("min_rating", minRating);
    const qs = params.toString();
    return `${API_BASE}${qs ? `?${qs}` : ""}`;
  };

  const fetchRecipes = async (page = 1, replace = true) => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const url = buildUrl(page, pageSize);
      const res = await axiosInstance.get(url);
      const data = res.data.data || res.data;
      const results = data.results || [];
      const serverCount =
        typeof data.count === "number"
          ? data.count
          : replace
          ? results.length
          : recipes.length + results.length;

      setCount(serverCount);
      setNextUrl(data.next || null);
      setPreviousUrl(data.previous || null);

      const derivedPageSize = results.length || pageSize;
      setTotalPages(Math.max(1, Math.ceil(serverCount / derivedPageSize)));

      if (replace) {
        setRecipes(results);
      } else {
        setRecipes((prev) => [...prev, ...results]);
      }
      setCurrentPage(page);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      setStatusMsg({ type: "danger", text: "Failed to load recipes." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, categoryFilter, countryFilter, minRating, pageSize]);

  const goToPage = (page) => {
    if (page < 1 || page > totalPages) return;
    fetchRecipes(page, true);
  };

  const loadMore = () => {
    const nextPage = currentPage + 1;
    if (nextPage > totalPages) return;
    fetchRecipes(nextPage, false);
  };

  const allCategories = useMemo(() => {
    const set = new Set();
    recipes.forEach((r) => (r.category || []).forEach((c) => c && set.add(c)));
    return Array.from(set).sort();
  }, [recipes]);

  const allCountries = useMemo(() => {
    const set = new Set();
    recipes.forEach((r) => r.country && set.add(r.country));
    return Array.from(set).sort();
  }, [recipes]);

  // ===== Modal & detail functions =====
  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setIsEditing(false);
    setStatusMsg(null);
    setNewImageFile(null);
    setImagePreview(null);
    setImageMode("upload");
    setImageUrlInput("");

    try {
      const res = await axiosInstance.get(`${API_BASE}${id}/`);
      const payload = res.data.data || res.data;
      payload.ingredients = payload.ingredients || [];
      payload.steps = payload.steps || [];
      payload.category = payload.category || [];
      setDetail(payload);

      // set preview and URL input appropriately
      const initialUrl = payload.image_url || null;
      setImagePreview(initialUrl);
      setImageUrlInput(initialUrl || "");
      // if initial image exists, default to URL mode so user can see pasteable URL
      setImageMode(initialUrl ? "url" : "upload");
    } catch (err) {
      console.error("Error fetching recipe detail", err);
      setStatusMsg({ type: "danger", text: "Failed to load recipe details." });
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeModal = () => {
    setSelectedId(null);
    setDetail(null);
    setIsEditing(false);
    setStatusMsg(null);
    setNewImageFile(null);
    setImagePreview(null);
    setImageMode("upload");
    setImageUrlInput("");
  };

  // ===== Category toggle =====
  const toggleCategory = (categoryName) => {
    setDetail((prev) => {
      const currentCategories = prev.category || [];
      if (currentCategories.includes(categoryName)) {
        return {
          ...prev,
          category: currentCategories.filter((c) => c !== categoryName),
        };
      } else {
        return {
          ...prev,
          category: [...currentCategories, categoryName],
        };
      }
    });
  };

  // ===== Edit helpers =====
  const newIngredient = () => ({
    id: `new-${Date.now()}-${Math.random()}`,
    name: "",
    quantity: "",
    unit: "",
  });
  const newStep = (n) => ({
    id: `new-${Date.now()}-${Math.random()}`,
    step_number: n || 1,
    description: "",
    duration: 0,
    step_type: "prep",
  });

  const addIngredient = () =>
    setDetail((d) => ({
      ...d,
      ingredients: [...(d.ingredients || []), newIngredient()],
    }));
  const removeIngredient = (id) =>
    setDetail((d) => ({
      ...d,
      ingredients: (d.ingredients || []).filter((i) => i.id !== id),
    }));
  const updateIngredient = (id, field, value) =>
    setDetail((d) => ({
      ...d,
      ingredients: (d.ingredients || []).map((i) =>
        i.id === id ? { ...i, [field]: value } : i
      ),
    }));

  const addStep = () =>
    setDetail((d) => ({
      ...d,
      steps: [...(d.steps || []), newStep((d.steps || []).length + 1)],
    }));
  const removeStep = (id) =>
    setDetail((d) => ({
      ...d,
      steps: (d.steps || []).filter((s) => s.id !== id),
    }));
  const updateStep = (id, field, value) =>
    setDetail((d) => ({
      ...d,
      steps: (d.steps || []).map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));

  const handleImageFile = (file) => {
    if (!file) {
      setNewImageFile(null);
      setImagePreview(detail?.image_url || null);
      return;
    }
    setNewImageFile(file);
    setImageUrlInput("");
    setImageMode("upload");
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);
  };

  // NEW: handle pasted image URL
  const handleImageUrlChange = (url) => {
    setImageUrlInput(url || "");
    setNewImageFile(null);
    setImageMode("url");
    if (!url) {
      setImagePreview(detail?.image_url || null);
      return;
    }
    // set preview to the url (will load if valid)
    setImagePreview(url);
    // also update detail so saveEdits can pick it up
    setDetail((d) => ({ ...(d || {}), image_url: url }));
  };

  // ===== SAVE: send ingredients_data & steps_data (fix) =====
  const saveEdits = async () => {
    if (!detail || !detail.id) return;
    setStatusMsg(null);
    try {
      // Basic fields
      const updateFields = {
        name: detail.name,
        description: detail.description,
        total_time: detail.total_time,
        servings: detail.servings,
        rating: detail.rating,
        category: detail.category || [], // Include categories
        // include other top-level fields if needed
      };

      // Build arrays according to API schema (ingredients_data / steps_data)
      const ingredientsData = (detail.ingredients || []).map((ing) => {
        // omit id for new ones; include for existing numeric ids
        const out = {
          name: ing.name ?? "",
          quantity: ing.quantity ?? "",
          unit: ing.unit ?? "",
        };
        if (typeof ing.id === "number") out.id = ing.id;
        return out;
      });

      const stepsData = (detail.steps || []).map((s, idx) => {
        const out = {
          step_number: s.step_number || idx + 1,
          description: s.description ?? "",
          duration: s.duration ?? 0,
          step_type: s.step_type ?? "prep",
        };
        if (typeof s.id === "number") out.id = s.id;
        return out;
      });

      // If user selected a new image file, send multipart and include JSON strings under the expected keys
      if (newImageFile) {
        const form = new FormData();
        Object.entries(updateFields).forEach(([k, v]) => {
          if (k === "category" && Array.isArray(v)) {
            form.append(k, JSON.stringify(v));
          } else {
            form.append(k, v ?? "");
          }
        });
        // IMPORTANT: use ingredients_data & steps_data keys (server expects these names)
        form.append("ingredients_data", JSON.stringify(ingredientsData));
        form.append("steps_data", JSON.stringify(stepsData));
        form.append("image", newImageFile); // adjust key if API expects a different name

        // If a URL was present previously, we don't append it; file takes precedence.

        await axiosInstance.put(`${API_BASE}${detail.id}/`, form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      } else {
        // JSON payload - keys must match API model
        const payload = {
          ...updateFields,
          ingredients_data: ingredientsData,
          steps_data: stepsData,
        };

        // NEW: if user pasted image URL (detail.image_url), include it in JSON payload
        if (detail.image_url) {
          payload.image_url = detail.image_url;
        }

        await axiosInstance.put(`${API_BASE}${detail.id}/`, payload, {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Re-fetch detail so we reflect server-side changes (IDs, ordering, etc.)
      const res = await axiosInstance.get(`${API_BASE}${detail.id}/`);
      const updated = res.data.data || res.data;
      updated.ingredients =
        updated.ingredients || updated.ingredients_data || [];
      updated.steps = updated.steps || updated.steps_data || [];
      updated.category = updated.category || [];
      setDetail(updated);
      setImagePreview(updated.image_url || null);
      setImageUrlInput(updated.image_url || "");
      setNewImageFile(null);
      setIsEditing(false);

      // Update list preview (optimistic)
      setRecipes((prev) =>
        prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
      );

      setStatusMsg({ type: "success", text: "Recipe updated successfully." });
    } catch (err) {
      console.error("Update failed", err);
      const serverMsg =
        err?.response?.data?.message ||
        JSON.stringify(err?.response?.data) ||
        err.message;
      setStatusMsg({
        type: "danger",
        text: `Failed to update recipe. ${serverMsg}`,
      });
    }
  };

  const deleteRecipe = async (id) => {
    if (!window.confirm("Delete this recipe? This cannot be undone.")) return;
    setStatusMsg(null);
    try {
      await axiosInstance.delete(`${API_BASE}${id}/`);
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      closeModal();
      setStatusMsg({ type: "success", text: "Recipe deleted." });
    } catch (err) {
      console.error("Delete failed", err);
      setStatusMsg({ type: "danger", text: "Failed to delete recipe." });
    }
  };

  // Client-side fallback filtering
  const clientFiltered = useMemo(() => {
    return recipes.filter((r) => {
      if (minRating) {
        const ratingNum = Number((r.rating || "0").toString());
        if (Number(minRating) && ratingNum < Number(minRating)) return false;
      }
      if (
        categoryFilter &&
        !(r.category || []).some(
          (c) => c && c.toLowerCase() === categoryFilter.toLowerCase()
        )
      )
        return false;
      if (
        countryFilter &&
        r.country &&
        r.country.toLowerCase() !== countryFilter.toLowerCase()
      )
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !(
            (r.name || "").toLowerCase().includes(q) ||
            (r.description || "").toLowerCase().includes(q)
          )
        )
          return false;
      }
      return true;
    });
  }, [recipes, search, categoryFilter, countryFilter, minRating]);

  const paginationRange = () => {
    const total = totalPages;
    const current = currentPage;
    const delta = 2;
    const range = [];
    for (
      let i = Math.max(1, current - delta);
      i <= Math.min(total, current + delta);
      i++
    )
      range.push(i);
    if (!range.includes(1)) range.unshift(1);
    if (!range.includes(total)) range.push(total);
    const compressed = [];
    for (let i = 0; i < range.length; i++) {
      const cur = range[i];
      const prev = compressed[compressed.length - 1];
      if (typeof prev === "number" && cur - prev > 1) compressed.push("...");
      compressed.push(cur);
    }
    return compressed;
  };

  return (
    <div className="container py-5">
      <style>{`
        .category-checkbox-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px;
          background-color: #fff;
          border-radius: 6px;
          border: 1px solid #e0dcd9;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .category-checkbox-item:hover {
          background-color: #fafaf8;
        }
        .category-checkbox-item.selected {
          background-color: #f0ebe5;
          border-color: #d4a574;
        }
        .category-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
          padding: 12px;
          background-color: #fafaf8;
          border-radius: 8px;
          border: 1px solid #dee2e6;
        }
      `}</style>

      {/* Header & Filters */}
      <div className="d-flex align-items-center justify-content-between mb-3 gap-3 flex-column flex-md-row">
        <div>
          <h1 className="h4 mb-0">🍳 Cookeaze — Recipes</h1>
          <small className="text-muted">
            Browse, filter, and manage recipes.
          </small>
        </div>

        <div className="d-flex gap-2 align-items-center flex-wrap">
          <input
            className="form-control form-control-sm"
            style={{ minWidth: 180 }}
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="form-select form-select-sm"
            style={{ minWidth: 160 }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="form-select form-select-sm"
            style={{ minWidth: 140 }}
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
          >
            <option value="">All countries</option>
            {allCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: 110 }}
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
          >
            <option value="">Min ⭐</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5</option>
          </select>

          <select
            className="form-select form-select-sm"
            style={{ width: 100 }}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            <option value={6}>6</option>
            <option value={9}>9</option>
            <option value={12}>12</option>
            <option value={24}>24</option>
          </select>

          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
              setCountryFilter("");
              setMinRating("");
              setPageSize(12);
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className={`alert alert-${statusMsg.type} mb-3`} role="alert">
          {statusMsg.text}
        </div>
      )}

      {loading && recipes.length === 0 ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            style={{ width: 60, height: 60 }}
            role="status"
          >
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            {clientFiltered.map((recipe) => (
              <div className="col-lg-4 col-md-6" key={recipe.id}>
                <div className="card h-100 shadow-sm">
                  <div style={{ height: 220, overflow: "hidden" }}>
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="w-100"
                      style={{ objectFit: "cover", height: "100%" }}
                    />
                  </div>
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title mb-1">{recipe.name}</h5>
                    <div className="mb-2">
                      {(recipe.category || []).map((c, i) => (
                        <span key={i} className="badge bg-primary me-1">
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="card-text text-muted small flex-grow-1">
                      {recipe.description?.slice(0, 110)}
                      {recipe.description && recipe.description.length > 110
                        ? "..."
                        : ""}
                    </p>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                      <div className="text-muted small">
                        ⏱ {recipe.total_time}m • 🍽 {recipe.servings} • ⭐{" "}
                        {recipe.rating}
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => openDetail(recipe.id)}
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {clientFiltered.length === 0 && (
              <div className="col-12 text-center py-5 text-muted">
                No recipes match your filters.
              </div>
            )}
          </div>

          <div className="d-flex justify-content-between align-items-center mt-4 flex-column flex-md-row gap-2">
            <div className="text-muted small">
              Showing page <strong>{currentPage}</strong> of{" "}
              <strong>{totalPages}</strong> — <strong>{count}</strong> results
            </div>

            <nav aria-label="Pagination">
              <ul className="pagination pagination-sm mb-0">
                <li
                  className={`page-item ${currentPage === 1 ? "disabled" : ""}`}
                >
                  <button className="page-link" onClick={() => goToPage(1)}>
                    « First
                  </button>
                </li>

                <li
                  className={`page-item ${currentPage === 1 ? "disabled" : ""}`}
                >
                  <button
                    className="page-link"
                    onClick={() => goToPage(currentPage - 1)}
                  >
                    ‹ Prev
                  </button>
                </li>

                {paginationRange().map((p, idx) =>
                  p === "..." ? (
                    <li key={`dots-${idx}`} className="page-item disabled">
                      <span className="page-link">…</span>
                    </li>
                  ) : (
                    <li
                      key={p}
                      className={`page-item ${
                        p === currentPage ? "active" : ""
                      }`}
                    >
                      <button className="page-link" onClick={() => goToPage(p)}>
                        {p}
                      </button>
                    </li>
                  )
                )}

                <li
                  className={`page-item ${
                    currentPage === totalPages ? "disabled" : ""
                  }`}
                >
                  <button
                    className="page-link"
                    onClick={() => goToPage(currentPage + 1)}
                  >
                    Next ›
                  </button>
                </li>

                <li
                  className={`page-item ${
                    currentPage === totalPages ? "disabled" : ""
                  }`}
                >
                  <button
                    className="page-link"
                    onClick={() => goToPage(totalPages)}
                  >
                    Last »
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </>
      )}

      {/* Detail modal */}
      {selectedId && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"
              role="document"
            >
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">
                    {detail ? detail.name : "Loading..."}
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={closeModal}
                  ></button>
                </div>

                <div
                  className="modal-body"
                  style={{ maxHeight: "70vh", overflowY: "auto" }}
                >
                  {detailLoading ? (
                    <div className="text-center py-4">
                      <div
                        className="spinner-border text-primary"
                        role="status"
                      >
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : detail ? (
                    <>
                      <div className="row mb-3">
                        <div className="col-md-8">
                          <div className="mb-3">
                            <label className="form-label small">Name</label>
                            <input
                              className="form-control"
                              value={detail.name || ""}
                              onChange={(e) =>
                                setDetail({ ...detail, name: e.target.value })
                              }
                              readOnly={!isEditing}
                            />
                          </div>

                          {/* Category Selection */}
                          <div className="mb-3">
                            <label className="form-label small">
                              Categories{" "}
                              {isEditing &&
                                `(${(detail.category || []).length} selected)`}
                            </label>
                            {isEditing ? (
                              <div className="category-grid">
                                {availableCategories.length === 0 ? (
                                  <div
                                    style={{
                                      gridColumn: "1 / -1",
                                      textAlign: "center",
                                      color: "#999",
                                      fontSize: "14px",
                                    }}
                                  >
                                    Loading categories...
                                  </div>
                                ) : (
                                  availableCategories.map((cat) => (
                                    <div
                                      key={cat.id}
                                      className={`category-checkbox-item ${
                                        (detail.category || []).includes(
                                          cat.category_name
                                        )
                                          ? "selected"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        toggleCategory(cat.category_name)
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={(
                                          detail.category || []
                                        ).includes(cat.category_name)}
                                        onChange={() =>
                                          toggleCategory(cat.category_name)
                                        }
                                        onClick={(e) => e.stopPropagation()}
                                        style={{ cursor: "pointer" }}
                                      />
                                      <label
                                        style={{
                                          cursor: "pointer",
                                          margin: 0,
                                          fontSize: "13px",
                                        }}
                                      >
                                        {cat.category_name}
                                      </label>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : (
                              <div>
                                {(detail.category || []).length > 0 ? (
                                  (detail.category || []).map((c, i) => (
                                    <span
                                      key={i}
                                      className="badge bg-primary me-1 mb-1"
                                    >
                                      {c}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-muted small">
                                    No categories
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="row g-2">
                            <div className="col-md-4 mb-3">
                              <label className="form-label small">
                                Total time (min)
                              </label>
                              <input
                                type="number"
                                className="form-control"
                                value={detail.total_time || 0}
                                onChange={(e) =>
                                  setDetail({
                                    ...detail,
                                    total_time: Number(e.target.value),
                                  })
                                }
                                readOnly={!isEditing}
                              />
                            </div>

                            <div className="col-md-4 mb-3">
                              <label className="form-label small">
                                Servings
                              </label>
                              <input
                                type="number"
                                className="form-control"
                                value={detail.servings || 1}
                                onChange={(e) =>
                                  setDetail({
                                    ...detail,
                                    servings: Number(e.target.value),
                                  })
                                }
                                readOnly={!isEditing}
                              />
                            </div>

                            <div className="col-md-4 mb-3">
                              <label className="form-label small">Rating</label>
                              <input
                                className="form-control"
                                value={detail.rating || ""}
                                onChange={(e) =>
                                  setDetail({
                                    ...detail,
                                    rating: e.target.value,
                                  })
                                }
                                readOnly={!isEditing}
                              />
                            </div>
                          </div>

                          <div className="mb-3">
                            <label className="form-label small">
                              Description
                            </label>
                            <textarea
                              className="form-control"
                              rows="3"
                              value={detail.description || ""}
                              onChange={(e) =>
                                setDetail({
                                  ...detail,
                                  description: e.target.value,
                                })
                              }
                              readOnly={!isEditing}
                            />
                          </div>
                        </div>

                        <div className="col-md-4">
                          <label className="form-label small">Image</label>
                          <div
                            className="mb-2 border rounded p-2 text-center"
                            style={{
                              minHeight: 180,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {imagePreview ? (
                              <img
                                src={imagePreview}
                                alt="preview"
                                className="img-fluid rounded"
                                style={{ maxHeight: 260 }}
                              />
                            ) : (
                              <div className="text-muted small">No image</div>
                            )}
                          </div>

                          {isEditing && (
                            <>
                              {/* NEW: Upload vs Paste URL toggle */}
                              <div className="mb-2 d-flex gap-2 align-items-center">
                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="imageMode"
                                    id="modeUpload"
                                    value="upload"
                                    checked={imageMode === "upload"}
                                    onChange={() => {
                                      setImageMode("upload");
                                      setImageUrlInput("");
                                      setImagePreview(
                                        detail?.image_url || null
                                      );
                                      setNewImageFile(null);
                                    }}
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="modeUpload"
                                  >
                                    Upload file
                                  </label>
                                </div>

                                <div className="form-check">
                                  <input
                                    className="form-check-input"
                                    type="radio"
                                    name="imageMode"
                                    id="modeUrl"
                                    value="url"
                                    checked={imageMode === "url"}
                                    onChange={() => {
                                      setImageMode("url");
                                      setNewImageFile(null);
                                      setImagePreview(
                                        detail?.image_url || null
                                      );
                                    }}
                                  />
                                  <label
                                    className="form-check-label"
                                    htmlFor="modeUrl"
                                  >
                                    Paste URL
                                  </label>
                                </div>
                              </div>

                              {imageMode === "upload" ? (
                                <>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="form-control form-control-sm mb-2"
                                    onChange={(e) =>
                                      handleImageFile(e.target.files[0])
                                    }
                                  />
                                  <small className="text-muted d-block">
                                    Choose a new image to upload (sent on Save).
                                  </small>
                                </>
                              ) : (
                                <>
                                  <input
                                    type="url"
                                    className="form-control form-control-sm mb-2"
                                    placeholder="https://example.com/logo.png"
                                    value={imageUrlInput}
                                    onChange={(e) =>
                                      handleImageUrlChange(e.target.value)
                                    }
                                  />
                                  <div className="d-flex gap-2">
                                    <button
                                      className="btn btn-sm btn-outline-secondary"
                                      onClick={() => {
                                        // if user wants to quickly use the original detail.image_url
                                        handleImageUrlChange(
                                          detail?.image_url || ""
                                        );
                                      }}
                                      type="button"
                                    >
                                      Use original
                                    </button>
                                    <button
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => {
                                        // re-validate / reload preview by re-setting preview
                                        handleImageUrlChange(imageUrlInput);
                                      }}
                                      type="button"
                                    >
                                      Preview URL
                                    </button>
                                  </div>
                                  <small className="text-muted d-block mt-1">
                                    Paste an absolute image URL. This URL will
                                    be saved as <code>image_url</code>.
                                  </small>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      <div className="row">
                        <div className="col-md-6 mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="mb-0">Ingredients</h6>
                            {isEditing && (
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={addIngredient}
                              >
                                + Add
                              </button>
                            )}
                          </div>

                          <div
                            style={{
                              maxHeight: 260,
                              overflowY: "auto",
                              paddingRight: 6,
                            }}
                          >
                            {(detail.ingredients || []).map((ing) => (
                              <div
                                key={ing.id}
                                className="border rounded p-2 mb-2"
                              >
                                {isEditing ? (
                                  <>
                                    <div className="mb-1 d-flex gap-2">
                                      <input
                                        className="form-control form-control-sm"
                                        placeholder="Quantity"
                                        value={ing.quantity || ""}
                                        onChange={(e) =>
                                          updateIngredient(
                                            ing.id,
                                            "quantity",
                                            e.target.value
                                          )
                                        }
                                      />
                                      <input
                                        className="form-control form-control-sm"
                                        placeholder="Unit"
                                        value={ing.unit || ""}
                                        onChange={(e) =>
                                          updateIngredient(
                                            ing.id,
                                            "unit",
                                            e.target.value
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="d-flex gap-2">
                                      <input
                                        className="form-control form-control-sm"
                                        placeholder="Ingredient name"
                                        value={ing.name || ""}
                                        onChange={(e) =>
                                          updateIngredient(
                                            ing.id,
                                            "name",
                                            e.target.value
                                          )
                                        }
                                      />
                                      <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => removeIngredient(ing.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div className="small">
                                    <strong>{ing.name}</strong>
                                    <br />
                                    <span className="text-muted">
                                      {ing.quantity || ""} {ing.unit || ""}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="col-md-6 mb-3">
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="mb-0">Steps</h6>
                            {isEditing && (
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={addStep}
                              >
                                + Add
                              </button>
                            )}
                          </div>

                          <div
                            style={{
                              maxHeight: 260,
                              overflowY: "auto",
                              paddingRight: 6,
                            }}
                          >
                            {(detail.steps || []).map((s, idx) => (
                              <div
                                key={s.id}
                                className="border rounded p-2 mb-2"
                              >
                                {isEditing ? (
                                  <>
                                    <div className="mb-1 d-flex gap-2">
                                      <input
                                        type="number"
                                        className="form-control form-control-sm"
                                        style={{ width: 90 }}
                                        value={s.step_number || idx + 1}
                                        onChange={(e) =>
                                          updateStep(
                                            s.id,
                                            "step_number",
                                            Number(e.target.value)
                                          )
                                        }
                                      />
                                      <select
                                        className="form-select form-select-sm"
                                        style={{ width: 140 }}
                                        value={s.step_type || "prep"}
                                        onChange={(e) =>
                                          updateStep(
                                            s.id,
                                            "step_type",
                                            e.target.value
                                          )
                                        }
                                      >
                                        <option value="prep">prep</option>
                                        <option value="cook">cook</option>
                                        <option value="serve">serve</option>
                                      </select>
                                      <input
                                        className="form-control form-control-sm"
                                        style={{ width: 90 }}
                                        value={s.duration || 0}
                                        onChange={(e) =>
                                          updateStep(
                                            s.id,
                                            "duration",
                                            Number(e.target.value)
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="d-flex gap-2">
                                      <textarea
                                        className="form-control form-control-sm"
                                        rows="2"
                                        placeholder="Step description"
                                        value={s.description || ""}
                                        onChange={(e) =>
                                          updateStep(
                                            s.id,
                                            "description",
                                            e.target.value
                                          )
                                        }
                                      />
                                      <button
                                        className="btn btn-sm btn-danger"
                                        onClick={() => removeStep(s.id)}
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <div>
                                    <small className="text-muted">
                                      Step {s.step_number}
                                    </small>
                                    <div>{s.description}</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="text-center text-muted">
                      No details available.
                    </div>
                  )}
                </div>

                <div className="modal-footer">
                  <div className="me-auto">
                    {isEditing ? (
                      <small className="text-muted">Editing — click Save</small>
                    ) : (
                      <small className="text-muted">View</small>
                    )}
                  </div>

                  {!detailLoading && detail && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            className="btn btn-danger"
                            onClick={() => deleteRecipe(detail.id)}
                          >
                            Delete
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => {
                              setIsEditing(false);
                              openDetail(detail.id);
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={saveEdits}
                          >
                            Save
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => deleteRecipe(detail.id)}
                          >
                            Delete
                          </button>
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => setIsEditing(true)}
                          >
                            Edit
                          </button>
                        </>
                      )}
                    </>
                  )}

                  <button
                    className="btn btn-link text-muted"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="modal-backdrop fade show"></div>
        </>
      )}
    </div>
  );
};

export default RecipeList;
