import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Trash2,
  Edit3,
  Plus,
  X,
  Save,
  Search,
  Eye,
  Palette,
  BookOpen,
  Layers,
  Upload,
  RefreshCw,
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { axiosInstance } from "../api";
import CloudinaryService from "./cloudinaryService";
import "./RecipeThemes.css";

const API_BASE_URL = "https://api.cookeaze.app/api/themes-recipes/";
const RECIPES_API_URL = "https://api.cookeaze.app/api/recipes/";
const RECIPES_CACHE_KEY = "cookeaze_recipes_catalog_v4";

function getCachedRecipes() {
  try {
    const raw =
      sessionStorage.getItem("cookeaze_recipes_catalog_v5") ||
      localStorage.getItem("cookeaze_recipes_catalog_v5") ||
      sessionStorage.getItem(RECIPES_CACHE_KEY) ||
      localStorage.getItem(RECIPES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
      return parsed.items;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

const THEME_COLOR_SWATCHES = [
  "#129575", // Emerald
  "#F97316", // Warm Orange
  "#EF4444", // Crimson
  "#8B5CF6", // Violet
  "#0EA5E9", // Sky Blue
  "#EAB308", // Amber Gold
  "#EC4899", // Rose
  "#10B981", // Mint
  "#6366F1", // Indigo
  "#1E293B", // Slate Dark
];

function colorIntToHex(colorInt) {
  const num = Number(colorInt);
  if (!Number.isFinite(num)) return "#129575";
  return "#" + ("00000000" + (num >>> 0).toString(16)).slice(-8).substring(2);
}

function hexToColorInt(hexStr) {
  const clean = String(hexStr || "#129575").replace("#", "").trim();
  const parsed = parseInt("FF" + clean, 16);
  return Number.isFinite(parsed) ? parsed : 4279326582;
}

function extractThemesList(resData) {
  if (!resData) return [];
  const root = resData.data !== undefined ? resData.data : resData;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.results)) return root.results;
  return [];
}

function extractRecipesPayload(resData) {
  if (!resData) return { results: [], count: 0 };
  const root = resData.data !== undefined ? resData.data : resData;
  if (Array.isArray(root)) {
    return { results: root, count: root.length };
  }
  const results = Array.isArray(root?.results) ? root.results : [];
  const count =
    typeof root?.count === "number"
      ? root.count
      : typeof resData?.count === "number"
      ? resData.count
      : results.length;
  return { results, count };
}

export default function RecipeThemesDashboard() {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [banner, setBanner] = useState(null); // { type: "success" | "error", text: string }

  // Filter & Sort
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "name" | "most_recipes"

  // Modals
  const [modalMode, setModalMode] = useState(null); // null | "create" | "edit" | "view"
  const [savingTheme, setSavingTheme] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // theme object

  const [currentTheme, setCurrentTheme] = useState({
    id: null,
    name: "",
    image_url: "",
    color: hexToColorInt("#129575"),
    recipes_id: [],
    recipes: [],
  });

  // Recipe Picker States inside Create/Edit Modal
  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipePage, setRecipePage] = useState(1);
  const [recipesCount, setRecipesCount] = useState(0);
  const [recipeViewMode, setRecipeViewMode] = useState("all"); // "all" | "selected"

  // Selected recipes full objects cache (so Selected tab always renders thumbnails & titles)
  const [selectedRecipesMap, setSelectedRecipesMap] = useState(() => new Map());
  const [selectedLoading, setSelectedLoading] = useState(false);

  const coverFileInputRef = useRef(null);

  const showToast = useCallback((text, type = "success") => {
    setBanner({ text, type });
  }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const t = setTimeout(() => setBanner(null), 4000);
    return () => clearTimeout(t);
  }, [banner]);

  // Fetch all themes
  const fetchThemes = useCallback(
    async (isSilent = false) => {
      try {
        if (isSilent) setRefreshing(true);
        else setLoading(true);

        const res = await axiosInstance.get(API_BASE_URL);
        const rawList = extractThemesList(res.data);

        // Deduplicate by ID
        const seen = new Set();
        const deduped = [];
        for (let i = 0; i < rawList.length; i += 1) {
          const item = rawList[i];
          if (item && item.id && !seen.has(String(item.id))) {
            seen.add(String(item.id));
            deduped.push(item);
          }
        }
        setThemes(deduped);
      } catch (err) {
        console.error("Failed to fetch themes:", err);
        showToast(
          err?.response?.data?.message || "Failed to load recipe themes.",
          "error"
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchThemes(false);
  }, [fetchThemes]);

  // Auto-recover on network reconnect or token refresh
  useEffect(() => {
    const handleOnline = () => fetchThemes(true);
    const handleTokenUpdated = () => fetchThemes(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("cookeaze:token-updated", handleTokenUpdated);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("cookeaze:token-updated", handleTokenUpdated);
    };
  }, [fetchThemes]);

  // Fetch recipes for picker (with local catalog fallback)
  const fetchRecipes = useCallback(async (page = 1, search = "") => {
    const trimmed = search.trim();
    try {
      setRecipesLoading(true);
      let url = `${RECIPES_API_URL}?page=${page}`;
      if (trimmed) {
        url += `&search=${encodeURIComponent(trimmed)}`;
      }
      const res = await axiosInstance.get(url);
      const { results, count } = extractRecipesPayload(res.data);

      const seen = new Set();
      const unique = [];
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        if (r && r.id && !seen.has(String(r.id))) {
          seen.add(String(r.id));
          unique.push(r);
        }
      }

      if (unique.length > 0 || trimmed) {
        setRecipes(unique);
        setRecipesCount(count || unique.length);
      } else {
        const cached = getCachedRecipes();
        if (cached.length > 0) {
          const start = (page - 1) * 20;
          setRecipes(cached.slice(start, start + 20));
          setRecipesCount(cached.length);
        } else {
          setRecipes([]);
          setRecipesCount(0);
        }
      }

      // Also index loaded recipes into selectedRecipesMap for instant lookup
      setSelectedRecipesMap((prev) => {
        const next = new Map(prev);
        unique.forEach((r) => next.set(Number(r.id), r));
        return next;
      });
    } catch (err) {
      console.error("Failed to fetch recipes:", err);
      const cached = getCachedRecipes();
      if (cached.length > 0) {
        const filtered = trimmed
          ? cached.filter((r) =>
              String(r.name || "")
                .toLowerCase()
                .includes(trimmed.toLowerCase())
            )
          : cached;
        const start = (page - 1) * 20;
        setRecipes(filtered.slice(start, start + 20));
        setRecipesCount(filtered.length);
      }
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  // Automatically fetch recipes when Create/Edit modal is open and search/page changes
  useEffect(() => {
    if (modalMode !== "create" && modalMode !== "edit") return undefined;
    const t = setTimeout(() => {
      fetchRecipes(recipePage, recipeSearch);
    }, 220);
    return () => clearTimeout(t);
  }, [modalMode, recipePage, recipeSearch, fetchRecipes]);

  // Ensure any missing selected recipe details are fetched
  const hydrateSelectedRecipes = useCallback(
    async (ids = []) => {
      const missingIds = ids.filter((id) => !selectedRecipesMap.has(Number(id)));
      if (!missingIds.length) return;

      try {
        setSelectedLoading(true);
        const results = await Promise.allSettled(
          missingIds.map((id) => axiosInstance.get(`${RECIPES_API_URL}${id}/`))
        );
        setSelectedRecipesMap((prev) => {
          const next = new Map(prev);
          results.forEach((r) => {
            if (r.status === "fulfilled") {
              const data = r.value.data?.data || r.value.data;
              if (data && data.id) {
                next.set(Number(data.id), data);
              }
            }
          });
          return next;
        });
      } finally {
        setSelectedLoading(false);
      }
    },
    [selectedRecipesMap]
  );

  // Open View / Create / Edit Modal
  const openModal = (mode, theme = null) => {
    setModalMode(mode);
    setRecipeSearch("");
    setRecipePage(1);
    setRecipeViewMode("all");

    if (theme) {
      const themeRecipes = Array.isArray(theme.recipes) ? theme.recipes : [];
      const selectedIds = themeRecipes.map((r) => Number(r.id));

      setSelectedRecipesMap((prev) => {
        const next = new Map(prev);
        themeRecipes.forEach((r) => {
          if (r && r.id) next.set(Number(r.id), r);
        });
        return next;
      });

      setCurrentTheme({
        id: theme.id,
        name: theme.name || "",
        image_url: theme.image_url || "",
        color: theme.color || hexToColorInt("#129575"),
        recipes_id: selectedIds,
        recipes: themeRecipes,
      });
    } else {
      setCurrentTheme({
        id: null,
        name: "",
        image_url: "",
        color: hexToColorInt("#129575"),
        recipes_id: [],
        recipes: [],
      });
    }

    if (mode === "create" || mode === "edit") {
      fetchRecipes(1, "");
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setRecipeSearch("");
    setRecipePage(1);
    setRecipeViewMode("all");
  };

  // Upload Cover Image via Cloudinary
  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      let uploadedUrl = "";
      if (CloudinaryService.cloudName && CloudinaryService.apiKey) {
        uploadedUrl = await CloudinaryService.uploadMedia(file, {
          folder: "cookeaze_themes",
        });
      }
      if (!uploadedUrl) {
        uploadedUrl = URL.createObjectURL(file);
      }
      setCurrentTheme((prev) => ({ ...prev, image_url: uploadedUrl }));
      showToast("Theme cover image uploaded.");
    } catch (err) {
      showToast("Failed to upload cover image.", "error");
    } finally {
      setUploadingCover(false);
      e.target.value = "";
    }
  };

  // Toggle recipe in currentTheme
  const toggleRecipeSelection = (recipeObjOrId) => {
    const rawId =
      typeof recipeObjOrId === "object" ? recipeObjOrId.id : recipeObjOrId;
    const recipeId = Number(rawId);

    if (typeof recipeObjOrId === "object" && recipeObjOrId?.id) {
      setSelectedRecipesMap((prev) => {
        const next = new Map(prev);
        next.set(recipeId, recipeObjOrId);
        return next;
      });
    }

    setCurrentTheme((prev) => {
      const exists = prev.recipes_id.some((id) => Number(id) === recipeId);
      const updatedIds = exists
        ? prev.recipes_id.filter((id) => Number(id) !== recipeId)
        : [...prev.recipes_id, recipeId];
      return { ...prev, recipes_id: updatedIds };
    });
  };

  // Save Create / Edit Theme
  const handleSaveTheme = async (e) => {
    e.preventDefault();
    if (!currentTheme.name.trim()) {
      showToast("Please enter a theme name.", "error");
      return;
    }
    if (!currentTheme.image_url.trim()) {
      showToast("Please provide a theme cover image.", "error");
      return;
    }

    setSavingTheme(true);
    const payload = {
      name: currentTheme.name.trim(),
      image_url: currentTheme.image_url.trim(),
      color: parseInt(currentTheme.color, 10) || hexToColorInt("#129575"),
      recipes_id: currentTheme.recipes_id.map((id) => parseInt(id, 10)),
    };

    try {
      if (modalMode === "create") {
        await axiosInstance.post(API_BASE_URL, payload);
        showToast(`Created theme "${payload.name}".`);
      } else {
        await axiosInstance.put(`${API_BASE_URL}${currentTheme.id}/`, payload);
        showToast(`Updated theme "${payload.name}".`);
      }
      closeModal();
      await fetchThemes(true);
    } catch (err) {
      showToast(
        err?.response?.data?.message || "Failed to save theme.",
        "error"
      );
    } finally {
      setSavingTheme(false);
    }
  };

  // Instant Optimistic Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    if (modalMode && currentTheme.id === target.id) {
      closeModal();
    }

    // Optimistically remove from list immediately
    setThemes((prev) => prev.filter((t) => t.id !== target.id));
    showToast(`Deleted theme "${target.name}".`);

    try {
      await axiosInstance.delete(`${API_BASE_URL}${target.id}/`);
    } catch (err) {
      showToast("Failed to delete theme on server. Reloading...", "error");
      fetchThemes(true);
    }
  };

  // Filtered & Sorted Themes
  const filteredThemes = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = themes.filter((t) => {
      if (!q) return true;
      const matchName = String(t.name || "")
        .toLowerCase()
        .includes(q);
      const matchRecipe = (t.recipes || []).some((r) =>
        String(r.name || "")
          .toLowerCase()
          .includes(q)
      );
      return matchName || matchRecipe;
    });

    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    } else if (sortBy === "most_recipes") {
      sorted.sort(
        (a, b) => (b.recipes?.length || 0) - (a.recipes?.length || 0)
      );
    } else {
      sorted.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }
    return sorted;
  }, [themes, searchTerm, sortBy]);

  // KPI Metrics
  const totalThemes = themes.length;
  const totalLinkedRecipes = useMemo(
    () => themes.reduce((acc, t) => acc + (t.recipes?.length || 0), 0),
    [themes]
  );
  const avgRecipesPerTheme =
    totalThemes > 0 ? Math.round(totalLinkedRecipes / totalThemes) : 0;

  const totalRecipePages = Math.max(1, Math.ceil(recipesCount / 20));
  const currentHex = colorIntToHex(currentTheme.color);

  const selectedRecipesList = useMemo(
    () =>
      currentTheme.recipes_id.map(
        (id) =>
          selectedRecipesMap.get(Number(id)) || {
            id,
            name: `Recipe #${id}`,
            image_url: "",
          }
      ),
    [currentTheme.recipes_id, selectedRecipesMap]
  );

  return (
    <div className="rthemes-page">
      {/* Hidden File Input for Theme Cover Upload */}
      <input
        ref={coverFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleCoverUpload}
      />

      {/* Header */}
      <header className="rthemes-header">
        <div>
          <h1 className="rthemes-title">Recipe Themes</h1>
          <p className="rthemes-subtitle">
            Curate visual recipe collections and seasonal themes for the Cookeaze
            home screen.
          </p>
        </div>

        <div className="rthemes-header-actions">
          <button
            type="button"
            className="rthemes-btn"
            onClick={() => fetchThemes(true)}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "imglib-spin" : ""} />
            Refresh
          </button>

          <button
            type="button"
            className="rthemes-btn rthemes-btn--primary"
            onClick={() => openModal("create")}
          >
            <Plus size={15} />
            New Theme
          </button>
        </div>
      </header>

      {/* Feedback Banner */}
      {banner && (
        <div
          role="alert"
          className={`rthemes-alert ${
            banner.type === "error"
              ? "rthemes-alert--error"
              : "rthemes-alert--success"
          }`}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
            }}
            onClick={() => setBanner(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 3 Compact KPI Cards */}
      <div className="rthemes-kpi-grid">
        <div className="rthemes-kpi-card">
          <div>
            <div className="rthemes-kpi-label">Active Themes</div>
            <div className="rthemes-kpi-value">{totalThemes}</div>
          </div>
          <div className="rthemes-kpi-icon">
            <Palette size={18} />
          </div>
        </div>

        <div className="rthemes-kpi-card">
          <div>
            <div className="rthemes-kpi-label">Linked Recipes</div>
            <div className="rthemes-kpi-value">{totalLinkedRecipes}</div>
          </div>
          <div className="rthemes-kpi-icon">
            <BookOpen size={18} />
          </div>
        </div>

        <div className="rthemes-kpi-card">
          <div>
            <div className="rthemes-kpi-label">Avg Recipes / Theme</div>
            <div className="rthemes-kpi-value">{avgRecipesPerTheme}</div>
          </div>
          <div className="rthemes-kpi-icon">
            <Layers size={18} />
          </div>
        </div>
      </div>

      {/* Search & Sort Toolbar */}
      <div className="rthemes-toolbar">
        <div className="rthemes-search">
          <Search size={15} className="rthemes-search-icon" />
          <input
            type="text"
            className="rthemes-search-input"
            placeholder="Search themes or included recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="rthemes-search-clear"
              onClick={() => setSearchTerm("")}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12.5, color: "#64748b" }}>
            Showing <strong>{filteredThemes.length}</strong> theme
            {filteredThemes.length === 1 ? "" : "s"}
          </span>

          <select
            className="rthemes-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort themes"
          >
            <option value="newest">Sort: Newest</option>
            <option value="most_recipes">Sort: Most Recipes</option>
            <option value="name">Sort: Name (A–Z)</option>
          </select>
        </div>
      </div>

      {/* Main 4-Column Theme Cards Grid */}
      {loading ? (
        <div className="rthemes-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="rthemes-card">
              <div className="rthemes-card-media rthemes-shimmer" />
              <div className="rthemes-card-body">
                <div
                  className="rthemes-shimmer"
                  style={{ height: 18, width: "70%", borderRadius: 6 }}
                />
                <div
                  className="rthemes-shimmer"
                  style={{ height: 24, width: "45%", borderRadius: 999 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : filteredThemes.length === 0 ? (
        <div className="rthemes-empty">
          <Palette size={34} color="#94a3b8" style={{ marginBottom: 8 }} />
          <h3 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>
            {searchTerm ? "No matching themes" : "No recipe themes yet"}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b" }}>
            {searchTerm
              ? "Try clearing your search filter."
              : "Create your first curated theme to showcase recipes on the app home screen."}
          </p>
          <button
            type="button"
            className="rthemes-btn rthemes-btn--primary"
            onClick={() => openModal("create")}
          >
            <Plus size={15} />
            Create Theme
          </button>
        </div>
      ) : (
        <div className="rthemes-grid">
          {filteredThemes.map((theme) => {
            const hexColor = colorIntToHex(theme.color);
            const themeRecipes = Array.isArray(theme.recipes)
              ? theme.recipes
              : [];
            const recipeCount = themeRecipes.length;

            return (
              <article key={theme.id} className="rthemes-card">
                <div
                  className="rthemes-card-media"
                  onClick={() => openModal("view", theme)}
                >
                  {theme.image_url ? (
                    <img
                      src={theme.image_url}
                      alt={theme.name}
                      className="rthemes-card-img"
                      loading="lazy"
                    />
                  ) : null}

                  <span
                    className="rthemes-card-swatch"
                    style={{ backgroundColor: hexColor }}
                    title={`Theme accent: ${hexColor}`}
                  />

                  <span className="rthemes-card-badge">
                    <BookOpen size={12} />
                    {recipeCount} {recipeCount === 1 ? "recipe" : "recipes"}
                  </span>
                </div>

                <div
                  className="rthemes-card-color-bar"
                  style={{ backgroundColor: hexColor }}
                />

                <div className="rthemes-card-body">
                  <h3
                    className="rthemes-card-title"
                    title={theme.name}
                    onClick={() => openModal("view", theme)}
                  >
                    {theme.name}
                  </h3>

                  {/* Visual Recipe Avatar Stack (no text clutter) */}
                  <div className="rthemes-avatar-row">
                    {recipeCount > 0 ? (
                      <div className="rthemes-avatars">
                        {themeRecipes.slice(0, 4).map((r) => (
                          <img
                            key={r.id}
                            src={r.image_url}
                            alt={r.name}
                            title={r.name}
                            className="rthemes-avatar"
                            loading="lazy"
                          />
                        ))}
                        {recipeCount > 4 && (
                          <span className="rthemes-avatar-more">
                            +{recipeCount - 4}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        No recipes linked
                      </span>
                    )}
                  </div>
                </div>

                <div className="rthemes-card-footer">
                  <button
                    type="button"
                    className="rthemes-card-action"
                    onClick={() => openModal("view", theme)}
                  >
                    <Eye size={13} />
                    View
                  </button>
                  <button
                    type="button"
                    className="rthemes-card-action"
                    onClick={() => openModal("edit", theme)}
                  >
                    <Edit3 size={13} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rthemes-card-action rthemes-card-action--icon"
                    title="Delete Theme"
                    onClick={() => setDeleteTarget(theme)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* VIEW THEME MODAL (Clean visual showcase) */}
      {modalMode === "view" && (
        <div className="rthemes-modal-backdrop" onClick={closeModal}>
          <div
            className="rthemes-modal rthemes-modal--md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rthemes-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 999,
                    backgroundColor: currentHex,
                    display: "inline-block",
                  }}
                />
                <h2 className="rthemes-modal-title">{currentTheme.name}</h2>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="rthemes-btn rthemes-btn--sm rthemes-btn--primary"
                  onClick={() => {
                    setModalMode("edit");
                    fetchRecipes(1, "");
                  }}
                >
                  <Edit3 size={13} />
                  Edit Theme
                </button>
                <button
                  type="button"
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                  }}
                  onClick={closeModal}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="rthemes-modal-body">
              {currentTheme.image_url && (
                <div
                  style={{
                    height: 180,
                    borderRadius: 12,
                    overflow: "hidden",
                    marginBottom: 18,
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <img
                    src={currentTheme.image_url}
                    alt={currentTheme.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, color: "#334155" }}>
                  Included Recipes ({selectedRecipesList.length})
                </span>
              </div>

              {selectedRecipesList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "28px 16px",
                    color: "#64748b",
                    fontSize: 13,
                    background: "#f8fafc",
                    borderRadius: 10,
                  }}
                >
                  No recipes added to this theme yet.
                </div>
              ) : (
                <div className="rthemes-recipe-picker-grid">
                  {selectedRecipesList.map((r) => (
                    <div key={r.id} className="rthemes-recipe-tile">
                      {r.image_url ? (
                        <img
                          src={r.image_url}
                          alt={r.name}
                          className="rthemes-recipe-tile-img"
                        />
                      ) : (
                        <div className="rthemes-recipe-tile-img" />
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="rthemes-recipe-tile-title">{r.name}</div>
                        {r.total_time ? (
                          <div style={{ fontSize: 11, color: "#64748b" }}>
                            {r.total_time}m
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rthemes-modal-footer">
              <button
                type="button"
                className="rthemes-btn rthemes-btn--danger"
                style={{ marginRight: "auto" }}
                onClick={() => setDeleteTarget(currentTheme)}
              >
                <Trash2 size={14} />
                Delete
              </button>
              <button type="button" className="rthemes-btn" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT 2-PANE THEME BUILDER MODAL */}
      {(modalMode === "create" || modalMode === "edit") && (
        <div className="rthemes-modal-backdrop" onClick={closeModal}>
          <div
            className="rthemes-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rthemes-modal-header">
              <h2 className="rthemes-modal-title">
                {modalMode === "create" ? "Create Recipe Theme" : "Edit Recipe Theme"}
              </h2>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                onClick={closeModal}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveTheme} style={{ display: "contents" }}>
              <div className="rthemes-modal-body">
                <div className="rthemes-builder-grid">
                  {/* LEFT PANE: Theme Identity & Visuals */}
                  <div className="rthemes-builder-left">
                    <div>
                      <label htmlFor="theme-name-input" className="rthemes-label">
                        Theme Name *
                      </label>
                      <input
                        id="theme-name-input"
                        type="text"
                        className="rthemes-input"
                        placeholder="e.g. Quick Weeknight Dinners"
                        value={currentTheme.name}
                        onChange={(e) =>
                          setCurrentTheme({
                            ...currentTheme,
                            name: e.target.value,
                          })
                        }
                        required
                      />
                    </div>

                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <label
                          htmlFor="theme-image-input"
                          className="rthemes-label"
                          style={{ marginBottom: 0 }}
                        >
                          Cover Image *
                        </label>
                        <button
                          type="button"
                          className="rthemes-btn rthemes-btn--sm"
                          onClick={() => coverFileInputRef.current?.click()}
                          disabled={uploadingCover}
                        >
                          <Upload size={12} />
                          {uploadingCover ? "Uploading..." : "Upload File"}
                        </button>
                      </div>

                      <input
                        id="theme-image-input"
                        type="url"
                        className="rthemes-input"
                        placeholder="https://..."
                        value={currentTheme.image_url}
                        onChange={(e) =>
                          setCurrentTheme({
                            ...currentTheme,
                            image_url: e.target.value,
                          })
                        }
                        required
                      />

                      <div
                        className="rthemes-preview-box"
                        style={{
                          marginTop: 8,
                          borderBottom: `4px solid ${currentHex}`,
                        }}
                      >
                        {currentTheme.image_url ? (
                          <img
                            src={currentTheme.image_url}
                            alt="Cover preview"
                            className="rthemes-preview-img"
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "#64748b" }}>
                            Cover preview
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="rthemes-label">Theme Accent Color</label>
                      <div className="rthemes-swatches">
                        {THEME_COLOR_SWATCHES.map((hex) => {
                          const isSelected =
                            currentHex.toLowerCase() === hex.toLowerCase();
                          return (
                            <button
                              key={hex}
                              type="button"
                              className={`rthemes-swatch-btn${
                                isSelected ? " rthemes-swatch-btn--active" : ""
                              }`}
                              style={{ backgroundColor: hex }}
                              title={hex}
                              onClick={() =>
                                setCurrentTheme({
                                  ...currentTheme,
                                  color: hexToColorInt(hex),
                                })
                              }
                            />
                          );
                        })}

                        <input
                          type="color"
                          value={currentHex}
                          onChange={(e) =>
                            setCurrentTheme({
                              ...currentTheme,
                              color: hexToColorInt(e.target.value),
                            })
                          }
                          title="Custom color picker"
                          style={{
                            width: 28,
                            height: 28,
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PANE: Recipe Selection */}
                  <div>
                    <div className="rthemes-picker-tabs">
                      <div className="rthemes-seg">
                        <button
                          type="button"
                          className={`rthemes-seg-btn${
                            recipeViewMode === "all"
                              ? " rthemes-seg-btn--active"
                              : ""
                          }`}
                          onClick={() => setRecipeViewMode("all")}
                        >
                          All Recipes
                        </button>
                        <button
                          type="button"
                          className={`rthemes-seg-btn${
                            recipeViewMode === "selected"
                              ? " rthemes-seg-btn--active"
                              : ""
                          }`}
                          onClick={() => {
                            setRecipeViewMode("selected");
                            hydrateSelectedRecipes(currentTheme.recipes_id);
                          }}
                        >
                          Selected ({currentTheme.recipes_id.length})
                        </button>
                      </div>

                      {recipeViewMode === "all" && (
                        <div
                          style={{
                            display: "flex",
                            gap: 6,
                            flex: 1,
                            maxWidth: 320,
                          }}
                        >
                          <input
                            type="text"
                            className="rthemes-input"
                            placeholder="Search recipes..."
                            value={recipeSearch}
                            onChange={(e) => {
                              setRecipeSearch(e.target.value);
                              setRecipePage(1);
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {recipeViewMode === "selected" ? (
                      selectedLoading ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "40px 16px",
                            color: "#64748b",
                            fontSize: 13,
                          }}
                        >
                          Loading selected recipes...
                        </div>
                      ) : selectedRecipesList.length === 0 ? (
                        <div
                          style={{
                            textAlign: "center",
                            padding: "48px 16px",
                            color: "#64748b",
                            background: "#f8fafc",
                            borderRadius: 12,
                            border: "1px dashed #cbd5e1",
                            fontSize: 13,
                          }}
                        >
                          No recipes selected yet. Switch to{" "}
                          <strong>All Recipes</strong> and click any recipe to
                          add it.
                        </div>
                      ) : (
                        <div className="rthemes-recipe-picker-grid">
                          {selectedRecipesList.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              className="rthemes-recipe-tile rthemes-recipe-tile--selected"
                              onClick={() => toggleRecipeSelection(r)}
                            >
                              {r.image_url ? (
                                <img
                                  src={r.image_url}
                                  alt={r.name}
                                  className="rthemes-recipe-tile-img"
                                />
                              ) : (
                                <div className="rthemes-recipe-tile-img" />
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className="rthemes-recipe-tile-title">
                                  {r.name}
                                </div>
                                <div style={{ fontSize: 11, color: "#065f46" }}>
                                  Click to remove
                                </div>
                              </div>
                              <X size={15} color="#dc2626" />
                            </button>
                          ))}
                        </div>
                      )
                    ) : recipesLoading ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "48px 16px",
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        Loading recipes...
                      </div>
                    ) : recipes.length === 0 ? (
                      <div
                        style={{
                          textAlign: "center",
                          padding: "48px 16px",
                          color: "#64748b",
                          fontSize: 13,
                        }}
                      >
                        <AlertCircle size={24} style={{ marginBottom: 6 }} />
                        <div>No recipes found.</div>
                      </div>
                    ) : (
                      <>
                        <div className="rthemes-recipe-picker-grid">
                          {recipes.map((r) => {
                            const isSelected = currentTheme.recipes_id.some(
                              (id) => Number(id) === Number(r.id)
                            );
                            return (
                              <button
                                key={r.id}
                                type="button"
                                className={`rthemes-recipe-tile${
                                  isSelected
                                    ? " rthemes-recipe-tile--selected"
                                    : ""
                                }`}
                                onClick={() => toggleRecipeSelection(r)}
                              >
                                {r.image_url ? (
                                  <img
                                    src={r.image_url}
                                    alt={r.name}
                                    className="rthemes-recipe-tile-img"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="rthemes-recipe-tile-img" />
                                )}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div className="rthemes-recipe-tile-title">
                                    {r.name}
                                  </div>
                                  <div style={{ fontSize: 11, color: "#64748b" }}>
                                    {r.total_time ? `${r.total_time}m` : "Recipe"}
                                  </div>
                                </div>
                                {isSelected ? (
                                  <Check size={15} color="#129575" />
                                ) : (
                                  <Plus size={15} color="#64748b" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {totalRecipePages > 1 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginTop: 12,
                              fontSize: 12,
                              color: "#64748b",
                            }}
                          >
                            <span>
                              Page {recipePage} of {totalRecipePages}
                            </span>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button
                                type="button"
                                className="rthemes-btn rthemes-btn--sm"
                                disabled={recipePage <= 1}
                                onClick={() => {
                                  const next = recipePage - 1;
                                  setRecipePage(next);
                                  fetchRecipes(next, recipeSearch);
                                }}
                              >
                                <ChevronLeft size={13} />
                                Prev
                              </button>
                              <button
                                type="button"
                                className="rthemes-btn rthemes-btn--sm"
                                disabled={recipePage >= totalRecipePages}
                                onClick={() => {
                                  const next = recipePage + 1;
                                  setRecipePage(next);
                                  fetchRecipes(next, recipeSearch);
                                }}
                              >
                                Next
                                <ChevronRight size={13} />
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="rthemes-modal-footer">
                <button
                  type="button"
                  className="rthemes-btn"
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rthemes-btn rthemes-btn--primary"
                  disabled={savingTheme}
                >
                  <Save size={14} />
                  {savingTheme
                    ? "Saving..."
                    : modalMode === "create"
                    ? "Create Theme"
                    : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget && (
        <div
          className="rthemes-modal-backdrop"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="rthemes-modal rthemes-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rthemes-modal-header">
              <h2 className="rthemes-modal-title">Delete Recipe Theme</h2>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="rthemes-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "#334155" }}>
                Are you sure you want to delete{" "}
                <strong>{deleteTarget.name}</strong>? This action cannot be
                undone.
              </p>
            </div>
            <div className="rthemes-modal-footer">
              <button
                type="button"
                className="rthemes-btn"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rthemes-btn rthemes-btn--danger-solid"
                onClick={handleConfirmDelete}
              >
                <Trash2 size={14} />
                Delete Theme
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
