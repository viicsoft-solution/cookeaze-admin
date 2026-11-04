// src/components/RecipeList.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Search,
  Plus,
  RefreshCw,
  Clock,
  Users,
  Star,
  Edit2,
  Trash2,
  X,
  Save,
  BookOpen,
  Tag,
  LayoutGrid,
  List as ListIcon,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Upload,
} from "lucide-react";
import CloudinaryService from "./cloudinaryService";
import { attachSessionInterceptors } from "../api";
import "./RecipeList.css";

const API_BASE = "https://api.cookeaze.app/api/recipes/";
const CATEGORIES_API = "https://api.cookeaze.app/api/categories/";
const RECIPES_CACHE_KEY = "cookeaze_recipes_catalog_v5";
let memoryRecipesCache = null;

const DELETED_CATEGORY_KEYS = new Set(["souschef", "souchef", "sous chef"]);

// Deduplicate category tags per recipe (case-insensitive, trimmed) and strip deleted categories
const cleanCategoryList = (cats, allowedLowerSet = null) => {
  if (!Array.isArray(cats)) return [];
  const seen = new Set();
  const out = [];
  cats.forEach((c) => {
    const raw =
      typeof c === "object" && c !== null
        ? c.category_name || c.name || c.title || ""
        : c;
    const trimmed = String(raw || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (DELETED_CATEGORY_KEYS.has(key)) return;
    if (allowedLowerSet && allowedLowerSet.size > 0 && !allowedLowerSet.has(key)) {
      return;
    }
    if (!seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  });
  return out;
};

// Strip heavy ingredients/steps arrays for catalog caching so 3,700+ recipes fit easily in storage
const compactRecipeForCatalog = (r) => {
  if (!r || typeof r !== "object") return r;
  return {
    id: r.id,
    name: String(r.name || "").trim(),
    description: r.description || "",
    total_time: r.total_time ?? 0,
    servings: r.servings ?? 1,
    rating: r.rating ?? "0.0",
    category: cleanCategoryList(r.category),
    image_url: r.image_url || "",
    creator_name: r.creator_name || "",
  };
};

// Deduplicate recipe list strictly by canonical ID
const dedupeRecipesById = (list) => {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  list.forEach((r) => {
    if (!r || r.id === undefined || r.id === null) return;
    const key = String(r.id).trim();
    if (!key) return;
    const compacted = compactRecipeForCatalog(r);
    if (!map.has(key)) {
      map.set(key, compacted);
    } else {
      map.set(key, { ...map.get(key), ...compacted });
    }
  });
  return Array.from(map.values());
};

const getCachedRecipesCatalog = () => {
  if (
    memoryRecipesCache &&
    memoryRecipesCache.complete === true &&
    Array.isArray(memoryRecipesCache.items) &&
    memoryRecipesCache.items.length > 0
  ) {
    return memoryRecipesCache.items;
  }
  try {
    // Purge legacy / partial caches so stuck partial counts (like 1,395) are cleared
    sessionStorage.removeItem("cookeaze_recipes_catalog_v2");
    sessionStorage.removeItem("cookeaze_recipes_catalog_v3");
    sessionStorage.removeItem("cookeaze_recipes_catalog_v4");
    localStorage.removeItem("cookeaze_recipes_catalog_v2");
    localStorage.removeItem("cookeaze_recipes_catalog_v3");
    localStorage.removeItem("cookeaze_recipes_catalog_v4");

    const raw =
      sessionStorage.getItem(RECIPES_CACHE_KEY) ||
      localStorage.getItem(RECIPES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        parsed.complete === true &&
        Array.isArray(parsed.items) &&
        parsed.items.length > 0
      ) {
        const deduped = dedupeRecipesById(parsed.items);
        memoryRecipesCache = { complete: true, items: deduped };
        return deduped;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

const saveRecipesCatalogCache = (list, isComplete = true) => {
  if (!Array.isArray(list) || !isComplete) return;
  const compacted = dedupeRecipesById(list);
  const payloadObj = {
    complete: true,
    updatedAt: Date.now(),
    items: compacted,
  };
  memoryRecipesCache = payloadObj;
  try {
    const serialized = JSON.stringify(payloadObj);
    sessionStorage.setItem(RECIPES_CACHE_KEY, serialized);
    localStorage.setItem(RECIPES_CACHE_KEY, serialized);
  } catch {
    // ignore quota errors
  }
};

const RecipeList = () => {
  const initialCached = getCachedRecipesCatalog();

  // Full catalog of recipes
  const [recipes, setRecipes] = useState(() => initialCached || []);
  const [loading, setLoading] = useState(() => !initialCached);
  const [syncingPages, setSyncingPages] = useState(false);
  const [syncProgressPct, setSyncProgressPct] = useState(() =>
    initialCached ? 100 : 0
  );
  const [isCatalogComplete, setIsCatalogComplete] = useState(() =>
    Boolean(initialCached)
  );
  const isCatalogCompleteRef = useRef(Boolean(initialCached));
  const [serverTotalCount, setServerTotalCount] = useState(() =>
    initialCached ? initialCached.length : 0
  );

  // UI & Pagination controls
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12); // 4x3 compact grid by default
  const [viewMode, setViewMode] = useState("grid"); // 'grid' | 'table'

  // Filters, Duplicate Control & Sorting
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [cookTimeFilter, setCookTimeFilter] = useState(""); // '' | 'quick' | 'medium' | 'long'
  const [minRating, setMinRating] = useState("");
  const [duplicateMode, setDuplicateMode] = useState("unique"); // 'unique' (avoid duplicates) | 'all' | 'duplicates'
  const [sortBy, setSortBy] = useState("newest"); // 'newest' | 'name_asc' | 'rating_desc' | 'time_asc'

  // Expanded category tags per card on Grid view
  const [expandedCardCatIds, setExpandedCardCatIds] = useState([]);

  // Quick single-card photo upload state
  const [quickUploadingRecipeId, setQuickUploadingRecipeId] = useState(null);
  const quickFileInputRef = useRef(null);
  const [quickTargetRecipe, setQuickTargetRecipe] = useState(null);

  // Single Recipe Modal / detail state
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);

  // Single delete confirmation modal
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingRecipe, setDeletingRecipe] = useState(false);

  // Bulk selection & bulk delete state
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Batch Editor Modal state (for editing multiple recipes batch-by-batch & fixing images)
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState([]);
  const [batchUploadingMap, setBatchUploadingMap] = useState({});
  const [batchSavingMap, setBatchSavingMap] = useState({});
  const [batchSavingAll, setBatchSavingAll] = useState(false);
  const [batchCategoryToApply, setBatchCategoryToApply] = useState("");

  // Categories for editing
  const [availableCategories, setAvailableCategories] = useState([]);
  const [categorySearchModal, setCategorySearchModal] = useState("");

  // Image edit in single modal
  const [imagePreview, setImagePreview] = useState(null);
  const [imageMode, setImageMode] = useState("upload");
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  // Status banner
  const [statusMsg, setStatusMsg] = useState(null);
  const token = localStorage.getItem("token");

  // Background catalog sync control & mutation pause/resume so user actions never abort or corrupt the full catalog
  const bgSyncAbortRef = useRef(null);
  const activeMutationsRef = useRef(0);
  const deletedIdsRef = useRef(new Set());
  const editedRecipesMapRef = useRef(new Map());

  const beginMutation = () => {
    activeMutationsRef.current += 1;
  };

  const endMutation = () => {
    activeMutationsRef.current = Math.max(0, activeMutationsRef.current - 1);
  };

  const waitUntilNoMutations = async (signal) => {
    while (activeMutationsRef.current > 0 && (!signal || !signal.aborted)) {
      await new Promise((r) => setTimeout(r, 120));
    }
  };

  const updateCatalogCacheIfComplete = (nextList) => {
    if (isCatalogCompleteRef.current) {
      saveRecipesCatalogCache(nextList, true);
    }
  };

  const axiosInstance = useMemo(
    () =>
      attachSessionInterceptors(
        axios.create({
          timeout: 25000,
          headers: {
            accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        })
      ),
    [token]
  );

  // Fetch available categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get(CATEGORIES_API);
        const catArray = res.data?.data || [];
        setAvailableCategories(Array.isArray(catArray) ? catArray : []);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        setAvailableCategories([]);
      }
    };
    fetchCategories();
  }, [axiosInstance]);

  // Auto-dismiss alerts
  useEffect(() => {
    let t;
    if (statusMsg) {
      t = setTimeout(() => setStatusMsg(null), 4500);
    }
    return () => clearTimeout(t);
  }, [statusMsg]);

  // Helper to build a valid PUT payload for any recipe object
  const buildRecipePutPayload = async (recipeLike, overrides = {}) => {
    let base = recipeLike;
    if (!base.ingredients || !base.steps) {
      const res = await axiosInstance.get(`${API_BASE}${recipeLike.id}/`);
      base = res.data?.data || res.data || recipeLike;
    }

    const merged = { ...base, ...overrides };

    const ingredientsData = (
      merged.ingredients ||
      merged.ingredients_data ||
      []
    ).map((ing) => {
      const out = {
        name: ing.name ?? "",
        quantity: ing.quantity ?? "",
        unit: ing.unit ?? "",
      };
      if (typeof ing.id === "number") out.id = ing.id;
      return out;
    });

    const stepsData = (merged.steps || merged.steps_data || []).map(
      (s, idx) => {
        const out = {
          step_number: s.step_number || idx + 1,
          description: s.description ?? "",
          duration: s.duration ?? 0,
          step_type: s.step_type ?? "prep",
        };
        if (typeof s.id === "number") out.id = s.id;
        return out;
      }
    );

    const payload = {
      name: merged.name || "",
      description: merged.description || "",
      total_time: Number(merged.total_time) || 0,
      servings: Number(merged.servings) || 1,
      rating: merged.rating ?? "0.0",
      category: cleanCategoryList(merged.category),
      ingredients_data: ingredientsData,
      steps_data: stepsData,
    };

    if (merged.image_url) {
      payload.image_url = merged.image_url.trim();
    }

    return payload;
  };

  // Resilient full-catalog loader with pause-on-mutation, automatic page retries, and strict deduplication
  const loadRecipeCatalog = async (forceRefresh = false) => {
    const cached = getCachedRecipesCatalog();
    if (cached && cached.length > 0 && !forceRefresh) {
      const filteredCached = dedupeRecipesById(
        cached.filter((r) => r && !deletedIdsRef.current.has(r.id))
      );
      setRecipes(filteredCached);
      setServerTotalCount(filteredCached.length);
      setIsCatalogComplete(true);
      isCatalogCompleteRef.current = true;
      setSyncProgressPct(100);
      setLoading(false);
      return;
    }

    if (!cached) {
      setLoading(true);
    }

    if (bgSyncAbortRef.current) {
      bgSyncAbortRef.current.abort();
    }
    const controller = new AbortController();
    bgSyncAbortRef.current = controller;

    try {
      const firstRes = await axiosInstance.get(`${API_BASE}?page=1`, {
        signal: controller.signal,
      });
      const firstData = firstRes.data?.data || firstRes.data || {};
      const rawFirstResults = Array.isArray(firstData.results)
        ? firstData.results
        : [];
      const firstResults = dedupeRecipesById(
        rawFirstResults.filter((r) => r && !deletedIdsRef.current.has(r.id))
      );
      const totalCount =
        typeof firstData.count === "number"
          ? Math.max(0, firstData.count - deletedIdsRef.current.size)
          : firstResults.length;

      setServerTotalCount(totalCount);

      if (!cached || forceRefresh) {
        setRecipes(firstResults);
        setLoading(false);
      }

      const perServerPage = rawFirstResults.length || 10;
      const totalServerPages = Math.ceil(
        (typeof firstData.count === "number" ? firstData.count : totalCount) /
          perServerPage
      );

      if (totalServerPages > 1) {
        setSyncingPages(true);
        setIsCatalogComplete(false);
        isCatalogCompleteRef.current = false;
        setSyncProgressPct(Math.round((1 / totalServerPages) * 100));

        const mergedMap = new Map();
        firstResults.forEach((r) => {
          if (r && r.id !== undefined && !deletedIdsRef.current.has(r.id)) {
            const key = String(r.id).trim();
            mergedMap.set(
              key,
              editedRecipesMapRef.current.get(r.id) ||
                compactRecipeForCatalog(r)
            );
          }
        });

        let pendingPages = [];
        for (let p = 2; p <= totalServerPages; p++) {
          pendingPages.push(p);
        }

        const BATCH_CONCURRENCY = 4;
        let completedPagesCount = 1;

        for (let attempt = 0; attempt < 3 && pendingPages.length > 0; attempt++) {
          if (controller.signal.aborted) break;
          if (attempt > 0) {
            await new Promise((r) => setTimeout(r, 450 * attempt));
          }

          const failedInThisPass = [];
          const stepSize = attempt === 0 ? BATCH_CONCURRENCY : 3;

          for (let i = 0; i < pendingPages.length; i += stepSize) {
            if (controller.signal.aborted) break;

            // Pause background batch while any user DELETE or PUT mutation is in flight
            await waitUntilNoMutations(controller.signal);
            if (controller.signal.aborted) break;

            const batchPages = pendingPages.slice(i, i + stepSize);
            const batchResponses = await Promise.allSettled(
              batchPages.map((p) =>
                axiosInstance.get(`${API_BASE}?page=${p}`, {
                  signal: controller.signal,
                })
              )
            );

            if (controller.signal.aborted) break;

            for (let idx = 0; idx < batchResponses.length; idx += 1) {
              const res = batchResponses[idx];
              const pageNum = batchPages[idx];
              if (res.status === "fulfilled") {
                completedPagesCount += 1;
                const d = res.value.data?.data || res.value.data || {};
                const items = Array.isArray(d.results) ? d.results : [];
                for (let j = 0; j < items.length; j += 1) {
                  const r = items[j];
                  if (
                    r &&
                    r.id !== undefined &&
                    !deletedIdsRef.current.has(r.id)
                  ) {
                    const key = String(r.id).trim();
                    mergedMap.set(
                      key,
                      editedRecipesMapRef.current.get(r.id) ||
                        compactRecipeForCatalog(r)
                    );
                  }
                }
              } else {
                const status = res.reason?.response?.status;
                // Only skip 404 (page no longer exists because recipes were deleted)
                if (status !== 404) {
                  failedInThisPass.push(pageNum);
                } else {
                  completedPagesCount += 1;
                }
              }
            }

            setSyncProgressPct(
              Math.min(
                99,
                Math.round((completedPagesCount / totalServerPages) * 100)
              )
            );

            // Progressively update loaded recipes list without overwriting serverTotalCount
            if (i % (stepSize * 5) === 0) {
              const currentList = Array.from(mergedMap.values()).filter(
                (r) => !deletedIdsRef.current.has(r.id)
              );
              setRecipes(currentList);
            }
          }

          pendingPages = failedInThisPass;
        }

        if (!controller.signal.aborted) {
          const finalList = Array.from(mergedMap.values()).filter(
            (r) => !deletedIdsRef.current.has(r.id)
          );
          setRecipes(finalList);
          setSyncProgressPct(100);

          // Only mark complete and cache to storage if all pages loaded cleanly
          if (pendingPages.length === 0 && finalList.length > 0) {
            setIsCatalogComplete(true);
            isCatalogCompleteRef.current = true;
            setServerTotalCount(finalList.length);
            saveRecipesCatalogCache(finalList, true);
          }
        }
      } else {
        setIsCatalogComplete(true);
        isCatalogCompleteRef.current = true;
        setSyncProgressPct(100);
        setRecipes(firstResults);
        setServerTotalCount(firstResults.length);
        saveRecipesCatalogCache(firstResults, true);
      }
    } catch (err) {
      if (err?.name === "CanceledError" || err?.code === "ERR_CANCELED") {
        return;
      }
      console.error("Error fetching recipes:", err);
      if (!getCachedRecipesCatalog()) {
        setStatusMsg({ type: "danger", text: "Failed to load recipes." });
      }
    } finally {
      setLoading(false);
      if (bgSyncAbortRef.current === controller) {
        setSyncingPages(false);
        bgSyncAbortRef.current = null;
      }
    }
  };

  useEffect(() => {
    loadRecipeCatalog(false);
    const handleOnline = () => {
      if (!isCatalogCompleteRef.current) {
        loadRecipeCatalog(true);
      }
    };
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
      if (bgSyncAbortRef.current) {
        bgSyncAbortRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset to page 1 whenever filters, search, duplicate mode, sort, or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    categoryFilter,
    cookTimeFilter,
    minRating,
    duplicateMode,
    sortBy,
    pageSize,
  ]);

  // Analyze catalog for duplicate titles/content so we can avoid duplicates or inspect them
  const catalogAnalysis = useMemo(() => {
    const idDeduped = dedupeRecipesById(recipes);
    // Sort newest first so we keep the newest/best version of any duplicate recipe title
    const ordered = [...idDeduped].sort((a, b) => {
      const aHasImg = Boolean(a.image_url && String(a.image_url).trim());
      const bHasImg = Boolean(b.image_url && String(b.image_url).trim());
      if (aHasImg !== bHasImg) return aHasImg ? -1 : 1;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    const seenTitles = new Map();
    const uniqueByTitle = [];
    const duplicatesOnly = [];

    ordered.forEach((r) => {
      const normalizedTitle = String(r.name || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
      if (!normalizedTitle) {
        uniqueByTitle.push(r);
        return;
      }
      if (!seenTitles.has(normalizedTitle)) {
        seenTitles.set(normalizedTitle, r);
        uniqueByTitle.push(r);
      } else {
        duplicatesOnly.push(r);
      }
    });

    return {
      allRecipes: idDeduped,
      uniqueByTitle,
      duplicatesOnly,
      duplicateCount: duplicatesOnly.length,
    };
  }, [recipes]);

  // Active recipe pool based on duplicate mode ('unique' avoids duplicates by default)
  const activeRecipesPool = useMemo(() => {
    if (duplicateMode === "duplicates") {
      return catalogAnalysis.duplicatesOnly;
    }
    if (duplicateMode === "all") {
      return catalogAnalysis.allRecipes;
    }
    return catalogAnalysis.uniqueByTitle;
  }, [duplicateMode, catalogAnalysis]);

  // Authoritative total count to display in KPI & All Categories
  const displayTotalCount = useMemo(() => {
    if (isCatalogComplete) {
      return activeRecipesPool.length;
    }
    return Math.max(activeRecipesPool.length, serverTotalCount);
  }, [isCatalogComplete, activeRecipesPool.length, serverTotalCount]);

  // Set of active category names (lowercase) from /api/categories/ so deleted categories never appear
  const activeCategoryLowerSet = useMemo(() => {
    const set = new Set();
    availableCategories.forEach((cat) => {
      const rawName = String(
        cat?.category_name || cat?.name || cat?.title || ""
      ).trim();
      if (!rawName) return;
      const lower = rawName.toLowerCase();
      if (!DELETED_CATEGORY_KEYS.has(lower)) {
        set.add(lower);
      }
    });
    return set;
  }, [availableCategories]);

  // Category list + counts across active recipe pool (strictly filtered against live /api/categories/)
  const categoryStats = useMemo(() => {
    const canonicalNames = new Map(); // lowerKey -> displayName
    const counts = new Map(); // lowerKey -> count

    availableCategories.forEach((cat) => {
      const rawName = String(
        cat?.category_name || cat?.name || cat?.title || ""
      ).trim();
      if (!rawName) return;
      const lower = rawName.toLowerCase();
      if (DELETED_CATEGORY_KEYS.has(lower)) return;
      if (!canonicalNames.has(lower)) {
        canonicalNames.set(lower, rawName);
        counts.set(lower, 0);
      }
    });

    const enforceLiveCategories = canonicalNames.size > 0;

    activeRecipesPool.forEach((r) => {
      const uniqueRecipeCats = cleanCategoryList(
        r.category,
        enforceLiveCategories ? activeCategoryLowerSet : null
      );
      uniqueRecipeCats.forEach((c) => {
        const lower = c.toLowerCase();
        if (DELETED_CATEGORY_KEYS.has(lower)) return;
        if (enforceLiveCategories && !canonicalNames.has(lower)) {
          return;
        }
        if (!canonicalNames.has(lower)) {
          canonicalNames.set(lower, c);
        }
        counts.set(lower, (counts.get(lower) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([lowerKey, cnt]) => ({
        name: canonicalNames.get(lowerKey) || lowerKey,
        count: cnt,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
  }, [activeRecipesPool, availableCategories, activeCategoryLowerSet]);

  // Automatically clear categoryFilter if the selected category was deleted
  useEffect(() => {
    if (!categoryFilter) return;
    const lowerFilter = categoryFilter.trim().toLowerCase();
    if (
      DELETED_CATEGORY_KEYS.has(lowerFilter) ||
      (activeCategoryLowerSet.size > 0 &&
        !activeCategoryLowerSet.has(lowerFilter))
    ) {
      setCategoryFilter("");
    }
  }, [categoryFilter, activeCategoryLowerSet]);

  // Filtered + Sorted recipes across activeRecipesPool
  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = activeRecipesPool.filter((r) => {
      if (categoryFilter) {
        const hasCat = (r.category || []).some(
          (c) => c && c.trim().toLowerCase() === categoryFilter.trim().toLowerCase()
        );
        if (!hasCat) return false;
      }

      if (cookTimeFilter) {
        const mins = Number(r.total_time) || 0;
        if (cookTimeFilter === "quick" && (mins <= 0 || mins > 30))
          return false;
        if (cookTimeFilter === "medium" && (mins <= 30 || mins > 60))
          return false;
        if (cookTimeFilter === "long" && mins <= 60) return false;
      }

      if (minRating) {
        const ratingNum = Number(r.rating) || 0;
        if (ratingNum < Number(minRating)) return false;
      }

      if (q) {
        const inName = (r.name || "").toLowerCase().includes(q);
        const inCreator = (r.creator_name || "").toLowerCase().includes(q);
        const inDesc = (r.description || "").toLowerCase().includes(q);
        const inCat = (r.category || []).some((c) =>
          (c || "").toLowerCase().includes(q)
        );
        const inIng = (r.ingredients || []).some((ing) =>
          (ing?.name || "").toLowerCase().includes(q)
        );
        if (!inName && !inCreator && !inDesc && !inCat && !inIng) {
          return false;
        }
      }

      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "name_asc") {
      sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "rating_desc") {
      sorted.sort(
        (a, b) => (Number(b.rating) || 0) - (Number(a.rating) || 0)
      );
    } else if (sortBy === "time_asc") {
      sorted.sort(
        (a, b) =>
          (Number(a.total_time) || 9999) - (Number(b.total_time) || 9999)
      );
    } else {
      sorted.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }

    return sorted;
  }, [
    activeRecipesPool,
    search,
    categoryFilter,
    cookTimeFilter,
    minRating,
    sortBy,
  ]);

  // Pagination slice
  const totalFilteredCount = filteredRecipes.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedRecipes = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredRecipes.slice(startIdx, startIdx + pageSize);
  }, [filteredRecipes, safeCurrentPage, pageSize]);

  const startItemNum =
    totalFilteredCount === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItemNum = Math.min(
    safeCurrentPage * pageSize,
    totalFilteredCount
  );

  const goToPage = (page) => {
    const target = Math.max(1, Math.min(totalPages, Number(page) || 1));
    setCurrentPage(target);
  };

  const hasActiveFilters = Boolean(
    search.trim() ||
      categoryFilter ||
      cookTimeFilter ||
      minRating ||
      duplicateMode === "duplicates"
  );

  // Derived KPIs across active recipe pool
  const avgCookTime = useMemo(() => {
    const source = hasActiveFilters ? filteredRecipes : activeRecipesPool;
    if (!source.length) return 0;
    const sum = source.reduce(
      (acc, r) => acc + (Number(r.total_time) || 0),
      0
    );
    return Math.round(sum / source.length);
  }, [activeRecipesPool, filteredRecipes, hasActiveFilters]);

  const avgRating = useMemo(() => {
    const source = hasActiveFilters ? filteredRecipes : activeRecipesPool;
    const rated = source.filter((r) => Number(r.rating) > 0);
    if (!rated.length) return "—";
    const sum = rated.reduce((acc, r) => acc + Number(r.rating), 0);
    return (sum / rated.length).toFixed(1);
  }, [activeRecipesPool, filteredRecipes, hasActiveFilters]);

  const toggleExpandCardCategories = (recipeId) => {
    setExpandedCardCatIds((prev) =>
      prev.includes(recipeId)
        ? prev.filter((id) => id !== recipeId)
        : [...prev, recipeId]
    );
  };

  // ===== Quick 1-Click Photo Replace directly from Recipe Card =====
  const triggerQuickPhotoUpload = (recipeObj, e) => {
    e.stopPropagation();
    setQuickTargetRecipe(recipeObj);
    if (quickFileInputRef.current) {
      quickFileInputRef.current.value = "";
      quickFileInputRef.current.click();
    }
  };

  const handleQuickPhotoFileSelected = async (e) => {
    const file = e.target.files?.[0];
    const target = quickTargetRecipe;
    if (!file || !target) return;

    beginMutation();
    try {
      setQuickUploadingRecipeId(target.id);
      setStatusMsg({
        type: "warning",
        text: `Uploading new photo for "${target.name}"...`,
      });

      const uploadedUrl = await CloudinaryService.uploadFile(file, {
        folder: "recipes",
      });

      const payload = await buildRecipePutPayload(target, {
        image_url: uploadedUrl,
      });

      await axiosInstance.put(`${API_BASE}${target.id}/`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      const updatedObj = compactRecipeForCatalog({
        ...target,
        image_url: uploadedUrl,
      });
      editedRecipesMapRef.current.set(target.id, updatedObj);

      setRecipes((prev) => {
        const next = dedupeRecipesById(
          prev.map((r) =>
            r.id === target.id ? { ...r, image_url: uploadedUrl } : r
          )
        );
        updateCatalogCacheIfComplete(next);
        return next;
      });

      setStatusMsg({
        type: "success",
        text: `Updated photo for "${target.name}".`,
      });
    } catch (err) {
      console.error("Quick photo update failed:", err);
      setStatusMsg({
        type: "danger",
        text: `Failed to update photo for "${target.name}".`,
      });
    } finally {
      endMutation();
      setQuickUploadingRecipeId(null);
      setQuickTargetRecipe(null);
    }
  };

  // ===== Batch Recipe Editor ("edit multiple recipes batch-by-batch & save") =====
  const buildDraftsFromList = (list) =>
    list.map((r) => ({
      id: r.id,
      name: r.name || "",
      description: r.description || "",
      total_time: r.total_time ?? 0,
      servings: r.servings ?? 1,
      rating: r.rating ?? "0.0",
      category: cleanCategoryList(r.category),
      image_url: r.image_url || "",
      ingredients: r.ingredients,
      steps: r.steps,
      dirty: false,
    }));

  const openBatchEditorForSelected = () => {
    const selectedObjects = recipes.filter((r) =>
      selectedRecipeIds.includes(r.id)
    );
    const targetList =
      selectedObjects.length > 0 ? selectedObjects : paginatedRecipes;
    if (targetList.length === 0) return;
    setBatchDrafts(buildDraftsFromList(targetList));
    setBatchCategoryToApply("");
    setShowBatchEditModal(true);
  };

  const openBatchEditorForCurrentPage = () => {
    if (paginatedRecipes.length === 0) return;
    setBatchDrafts(buildDraftsFromList(paginatedRecipes));
    setBatchCategoryToApply("");
    setShowBatchEditModal(true);
  };

  const switchBatchEditorToPage = (targetPageNum) => {
    const safeTarget = Math.max(1, Math.min(totalPages, targetPageNum));
    setCurrentPage(safeTarget);
    const startIdx = (safeTarget - 1) * pageSize;
    const nextPageSlice = filteredRecipes.slice(startIdx, startIdx + pageSize);
    setBatchDrafts(buildDraftsFromList(nextPageSlice));
  };

  const updateBatchDraftField = (id, field, value) => {
    setBatchDrafts((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, [field]: value, dirty: true } : d
      )
    );
  };

  const removeCategoryFromBatchDraft = (id, catName) => {
    setBatchDrafts((prev) =>
      prev.map((d) =>
        d.id === id
          ? {
              ...d,
              category: (d.category || []).filter((c) => c !== catName),
              dirty: true,
            }
          : d
      )
    );
  };

  const addCategoryToBatchDraft = (id, catName) => {
    if (!catName) return;
    setBatchDrafts((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const existing = d.category || [];
        if (existing.includes(catName)) return d;
        return {
          ...d,
          category: cleanCategoryList([...existing, catName]),
          dirty: true,
        };
      })
    );
  };

  const applyCategoryToEntireBatch = (mode = "add") => {
    if (!batchCategoryToApply) return;
    setBatchDrafts((prev) =>
      prev.map((d) => {
        const cur = d.category || [];
        if (mode === "add") {
          if (cur.includes(batchCategoryToApply)) return d;
          return {
            ...d,
            category: cleanCategoryList([...cur, batchCategoryToApply]),
            dirty: true,
          };
        }
        if (!cur.includes(batchCategoryToApply)) return d;
        return {
          ...d,
          category: cur.filter((c) => c !== batchCategoryToApply),
          dirty: true,
        };
      })
    );
  };

  const handleBatchImageUpload = async (draftId, file) => {
    if (!file) return;
    setBatchUploadingMap((prev) => ({ ...prev, [draftId]: true }));
    try {
      const uploadedUrl = await CloudinaryService.uploadFile(file, {
        folder: "recipes",
      });
      updateBatchDraftField(draftId, "image_url", uploadedUrl);
    } catch (err) {
      console.error("Batch image upload failed:", err);
      setStatusMsg({
        type: "danger",
        text: `Image upload failed: ${err.message || err}`,
      });
    } finally {
      setBatchUploadingMap((prev) => ({ ...prev, [draftId]: false }));
    }
  };

  const saveSingleBatchDraft = async (draft) => {
    setBatchSavingMap((prev) => ({ ...prev, [draft.id]: true }));
    beginMutation();
    try {
      const original = recipes.find((r) => r.id === draft.id) || draft;
      const payload = await buildRecipePutPayload(original, draft);
      const res = await axiosInstance.put(`${API_BASE}${draft.id}/`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      const updated = res.data?.data || res.data || { ...original, ...draft };

      const mergedRecipe = compactRecipeForCatalog({
        ...original,
        ...updated,
        name: draft.name,
        total_time: Number(draft.total_time) || 0,
        servings: Number(draft.servings) || 1,
        rating: draft.rating,
        category: cleanCategoryList(draft.category),
        image_url: draft.image_url,
      });
      editedRecipesMapRef.current.set(draft.id, mergedRecipe);

      setRecipes((prev) => {
        const next = dedupeRecipesById(
          prev.map((r) => (r.id === draft.id ? { ...r, ...mergedRecipe } : r))
        );
        updateCatalogCacheIfComplete(next);
        return next;
      });

      setBatchDrafts((prev) =>
        prev.map((d) => (d.id === draft.id ? { ...d, dirty: false } : d))
      );
      return true;
    } catch (err) {
      console.error(`Failed saving recipe ${draft.id}:`, err);
      return false;
    } finally {
      endMutation();
      setBatchSavingMap((prev) => ({ ...prev, [draft.id]: false }));
    }
  };

  const saveAllBatchDrafts = async (moveToNextPageAfter = false) => {
    const targets = batchDrafts.filter((d) => d.dirty);
    const listToSave = targets.length > 0 ? targets : batchDrafts;
    if (listToSave.length === 0) return;

    setBatchSavingAll(true);
    try {
      const results = await Promise.all(
        listToSave.map((d) => saveSingleBatchDraft(d))
      );
      const savedCount = results.filter(Boolean).length;
      const failedCount = listToSave.length - savedCount;

      if (failedCount === 0) {
        setStatusMsg({
          type: "success",
          text: `Saved ${savedCount} ${
            savedCount === 1 ? "recipe" : "recipes"
          } in batch.`,
        });
        if (moveToNextPageAfter && safeCurrentPage < totalPages) {
          switchBatchEditorToPage(safeCurrentPage + 1);
        } else if (!moveToNextPageAfter) {
          setShowBatchEditModal(false);
        }
      } else {
        setStatusMsg({
          type: "warning",
          text: `Saved ${savedCount} recipes (${failedCount} failed).`,
        });
      }
    } finally {
      setBatchSavingAll(false);
    }
  };

  // ===== Single Recipe Modal & detail functions =====
  const openDetail = async (id, startInEditMode = false) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setIsEditing(startInEditMode);
    setImagePreview(null);
    setImageMode("upload");
    setImageUrlInput("");
    setUploadingImage(false);

    try {
      const res = await axiosInstance.get(`${API_BASE}${id}/`);
      const payload = res.data.data || res.data;
      payload.ingredients = payload.ingredients || [];
      payload.steps = payload.steps || [];
      payload.category = cleanCategoryList(payload.category);
      setDetail(payload);

      const initialUrl = payload.image_url || null;
      setImagePreview(initialUrl);
      setImageUrlInput(initialUrl || "");
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
    setImagePreview(null);
    setImageMode("upload");
    setImageUrlInput("");
    setUploadingImage(false);
    setCategorySearchModal("");
  };

  // ===== Category toggle & quick remove =====
  const toggleCategory = (categoryName) => {
    setDetail((prev) => {
      const currentCategories = cleanCategoryList(prev.category);
      if (currentCategories.includes(categoryName)) {
        return {
          ...prev,
          category: currentCategories.filter((c) => c !== categoryName),
        };
      }
      return {
        ...prev,
        category: cleanCategoryList([...currentCategories, categoryName]),
      };
    });
  };

  const clearAllModalCategories = () => {
    setDetail((prev) => ({
      ...prev,
      category: [],
    }));
  };

  // Instant one-click category removal from card/table/view modal
  const quickRemoveCategoryFromRecipe = async (
    recipeObj,
    categoryToRemove,
    isFromModal = false
  ) => {
    if (!recipeObj || !recipeObj.id) return;
    const prevCategories = cleanCategoryList(recipeObj.category);
    const nextCategories = prevCategories.filter(
      (c) => c.toLowerCase() !== String(categoryToRemove || "").toLowerCase()
    );

    const updatedObj = compactRecipeForCatalog({
      ...recipeObj,
      category: nextCategories,
    });
    editedRecipesMapRef.current.set(recipeObj.id, updatedObj);

    // Optimistically update list, cache, and modal
    setRecipes((prev) => {
      const next = dedupeRecipesById(
        prev.map((r) =>
          r.id === recipeObj.id ? { ...r, category: nextCategories } : r
        )
      );
      updateCatalogCacheIfComplete(next);
      return next;
    });

    if (isFromModal || (detail && detail.id === recipeObj.id)) {
      setDetail((prev) =>
        prev ? { ...prev, category: nextCategories } : prev
      );
    }

    beginMutation();
    try {
      const baseSource =
        detail && detail.id === recipeObj.id ? detail : recipeObj;
      const payload = await buildRecipePutPayload(baseSource, {
        category: nextCategories,
      });

      await axiosInstance.put(`${API_BASE}${recipeObj.id}/`, payload, {
        headers: { "Content-Type": "application/json" },
      });

      setStatusMsg({
        type: "success",
        text: `Removed "${categoryToRemove}" from ${recipeObj.name}.`,
      });
    } catch (err) {
      console.error("Failed to remove category:", err);
      editedRecipesMapRef.current.delete(recipeObj.id);
      setRecipes((prev) => {
        const reverted = dedupeRecipesById(
          prev.map((r) =>
            r.id === recipeObj.id ? { ...r, category: prevCategories } : r
          )
        );
        updateCatalogCacheIfComplete(reverted);
        return reverted;
      });
      if (isFromModal || (detail && detail.id === recipeObj.id)) {
        setDetail((prev) =>
          prev ? { ...prev, category: prevCategories } : prev
        );
      }
      setStatusMsg({
        type: "danger",
        text: `Failed to remove category "${categoryToRemove}".`,
      });
    } finally {
      endMutation();
    }
  };

  // ===== Edit helpers =====
  const addIngredient = () => {
    setDetail((prev) => ({
      ...prev,
      ingredients: [
        ...(prev.ingredients || []),
        { id: `new-${Date.now()}`, name: "", quantity: "", unit: "" },
      ],
    }));
  };

  const updateIngredient = (id, field, value) => {
    setDetail((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing) =>
        ing.id === id ? { ...ing, [field]: value } : ing
      ),
    }));
  };

  const removeIngredient = (id) => {
    setDetail((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((ing) => ing.id !== id),
    }));
  };

  const addStep = () => {
    setDetail((prev) => {
      const nextNum = (prev.steps?.length || 0) + 1;
      return {
        ...prev,
        steps: [
          ...(prev.steps || []),
          {
            id: `new-${Date.now()}`,
            step_number: nextNum,
            description: "",
            duration: 0,
            step_type: "prep",
          },
        ],
      };
    });
  };

  const updateStep = (id, field, value) => {
    setDetail((prev) => ({
      ...prev,
      steps: prev.steps.map((s) =>
        s.id === id ? { ...s, [field]: value } : s
      ),
    }));
  };

  const removeStep = (id) => {
    setDetail((prev) => {
      const filtered = prev.steps
        .filter((s) => s.id !== id)
        .map((s, idx) => ({ ...s, step_number: idx + 1 }));
      return { ...prev, steps: filtered };
    });
  };

  // ===== Image handlers =====
  const handleImageFileChange = async (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      setUploadingImage(true);
      setStatusMsg({ type: "warning", text: "Uploading image..." });

      const uploadedUrl = await CloudinaryService.uploadFile(file, {
        folder: "recipes",
      });

      setDetail((prev) => ({ ...prev, image_url: uploadedUrl }));
      setImagePreview(uploadedUrl);
      setImageUrlInput(uploadedUrl);
      setStatusMsg({ type: "success", text: "Image uploaded to Cloudinary." });
    } catch (err) {
      console.error("Cloudinary upload failed:", err);
      setStatusMsg({
        type: "danger",
        text: `Image upload failed: ${err.message || err}`,
      });
      setImagePreview(detail?.image_url || null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUrlChange = (url) => {
    setImageUrlInput(url);
    setImagePreview(url || null);
    setDetail((prev) => ({ ...prev, image_url: url }));
  };

  // ===== Save & Delete API =====
  const saveEdits = async () => {
    if (!detail) return;
    setStatusMsg(null);

    if (uploadingImage) {
      setStatusMsg({
        type: "warning",
        text: "Please wait for the image upload to finish.",
      });
      return;
    }

    beginMutation();
    try {
      setSavingEdits(true);
      const url = `${API_BASE}${detail.id}/`;

      const finalImageUrl =
        imageMode === "url"
          ? imageUrlInput
            ? imageUrlInput.trim()
            : ""
          : detail.image_url || "";

      const payload = await buildRecipePutPayload(detail, {
        image_url: finalImageUrl,
      });

      const res = await axiosInstance.put(url, payload, {
        headers: { "Content-Type": "application/json" },
      });

      const updated = res.data.data || res.data;
      updated.ingredients = updated.ingredients || detail.ingredients || [];
      updated.steps = updated.steps || detail.steps || [];
      updated.category = cleanCategoryList(
        updated.category || detail.category || []
      );

      setDetail(updated);
      setIsEditing(false);
      setImagePreview(updated.image_url || null);
      setImageUrlInput(updated.image_url || "");

      editedRecipesMapRef.current.set(
        updated.id,
        compactRecipeForCatalog(updated)
      );

      setRecipes((prev) => {
        const next = dedupeRecipesById(
          prev.map((r) =>
            r.id === updated.id ? { ...r, ...updated } : r
          )
        );
        updateCatalogCacheIfComplete(next);
        return next;
      });

      setStatusMsg({
        type: "success",
        text: "Recipe updated successfully.",
      });
    } catch (err) {
      console.error("Update failed", err);
      const serverMsg =
        err?.response?.data?.message ||
        JSON.stringify(err?.response?.data) ||
        err.message;
      setStatusMsg({
        type: "danger",
        text: `Failed to update recipe: ${serverMsg}`,
      });
    } finally {
      endMutation();
      setSavingEdits(false);
    }
  };

  const confirmDeleteRecipe = async () => {
    const idToDelete = confirmDeleteId;
    if (!idToDelete) return;

    deletedIdsRef.current.add(idToDelete);
    const removedRecipe = recipes.find((r) => r.id === idToDelete) || null;

    // Close modal & remove recipe from UI immediately (optimistic deletion — 0ms wait)
    setConfirmDeleteId(null);
    setDeletingRecipe(false);
    if (selectedId === idToDelete) {
      closeModal();
    }

    setRecipes((prev) => {
      const next = dedupeRecipesById(
        prev.filter((r) => r.id !== idToDelete)
      );
      updateCatalogCacheIfComplete(next);
      return next;
    });
    setSelectedRecipeIds((prev) => prev.filter((id) => id !== idToDelete));
    setServerTotalCount((prev) => Math.max(0, prev - 1));
    setStatusMsg({
      type: "success",
      text: removedRecipe?.name
        ? `Deleted "${removedRecipe.name}".`
        : "Recipe deleted successfully.",
    });

    beginMutation();
    try {
      await axiosInstance.delete(`${API_BASE}${idToDelete}/`, {
        timeout: 15000,
      });
    } catch (err) {
      const status = err?.response?.status;
      if (status === 404) return;

      console.error("Delete failed", err);
      deletedIdsRef.current.delete(idToDelete);
      if (removedRecipe) {
        setRecipes((prev) => {
          if (prev.some((r) => r.id === idToDelete)) return prev;
          const restored = dedupeRecipesById([removedRecipe, ...prev]);
          updateCatalogCacheIfComplete(restored);
          return restored;
        });
        setServerTotalCount((prev) => prev + 1);
      }
      setStatusMsg({
        type: "danger",
        text: `Failed to delete recipe${
          removedRecipe?.name ? ` "${removedRecipe.name}"` : ""
        }. Please try again.`,
      });
    } finally {
      endMutation();
    }
  };

  // ===== Bulk selection & bulk delete =====
  const toggleSelectRecipe = (id) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllOnPage = (visibleList) => {
    const visibleIds = visibleList.map((r) => r.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedRecipeIds.includes(id));

    if (allSelected) {
      setSelectedRecipeIds((prev) =>
        prev.filter((id) => !visibleIds.includes(id))
      );
    } else {
      setSelectedRecipeIds((prev) =>
        Array.from(new Set([...prev, ...visibleIds]))
      );
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedRecipeIds.length === 0) return;

    const idsToDelete = [...selectedRecipeIds];
    const idSet = new Set(idsToDelete);

    idsToDelete.forEach((id) => deletedIdsRef.current.add(id));
    const removedRecipes = recipes.filter((r) => idSet.has(r.id));

    // Close modal & optimistically remove selected recipes immediately (0ms wait — never gets stuck)
    setShowBulkDeleteConfirm(false);
    setBulkDeleting(false);
    setSelectedRecipeIds([]);
    if (selectedId && idSet.has(selectedId)) {
      closeModal();
    }

    setRecipes((prev) => {
      const next = dedupeRecipesById(prev.filter((r) => !idSet.has(r.id)));
      updateCatalogCacheIfComplete(next);
      return next;
    });
    setServerTotalCount((prev) => Math.max(0, prev - idsToDelete.length));
    setStatusMsg({
      type: "success",
      text: `Deleted ${idsToDelete.length} ${
        idsToDelete.length === 1 ? "recipe" : "recipes"
      } successfully.`,
    });

    beginMutation();
    try {
      const results = await Promise.allSettled(
        idsToDelete.map((id) =>
          axiosInstance.delete(`${API_BASE}${id}/`, { timeout: 15000 })
        )
      );

      const failedIds = idsToDelete.filter((_, idx) => {
        const res = results[idx];
        if (res.status === "fulfilled") return false;
        if (res.reason?.response?.status === 404) return false;
        return true;
      });

      if (failedIds.length > 0) {
        const failedSet = new Set(failedIds);
        failedIds.forEach((id) => deletedIdsRef.current.delete(id));
        const toRestore = removedRecipes.filter((r) => failedSet.has(r.id));

        if (toRestore.length > 0) {
          setRecipes((prev) => {
            const next = dedupeRecipesById([...toRestore, ...prev]);
            updateCatalogCacheIfComplete(next);
            return next;
          });
          setServerTotalCount((prev) => prev + toRestore.length);
        }

        const succeededCount = idsToDelete.length - failedIds.length;
        setStatusMsg({
          type: succeededCount > 0 ? "warning" : "danger",
          text:
            succeededCount > 0
              ? `Deleted ${succeededCount} recipes (${failedIds.length} could not be deleted).`
              : `Failed to delete ${failedIds.length} ${
                  failedIds.length === 1 ? "recipe" : "recipes"
                }. Please check your connection and try again.`,
        });
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
    } finally {
      endMutation();
    }
  };

  const paginationRange = () => {
    const total = totalPages;
    const current = safeCurrentPage;
    const delta = 2;
    const range = [];
    for (
      let i = Math.max(1, current - delta);
      i <= Math.min(total, current + delta);
      i++
    ) {
      range.push(i);
    }
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

  const resetAllFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setCookTimeFilter("");
    setMinRating("");
    setDuplicateMode("unique");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const dirtyBatchCount = batchDrafts.filter((d) => d.dirty).length;

  // Shimmer Skeleton for initial data fetch
  if (loading && recipes.length === 0) {
    return (
      <div className="rcp-page">
        <header className="rcp-header">
          <div>
            <h1 className="rcp-title">Recipe Directory</h1>
            <p className="rcp-subtitle">
              Browse, curate, and manage culinary recipes across the Cookeaze platform.
            </p>
          </div>
          <div className="rcp-header-actions">
            <div
              className="shimmer"
              style={{ width: 100, height: 36, borderRadius: 7 }}
            />
            <div
              className="shimmer"
              style={{ width: 145, height: 36, borderRadius: 7 }}
            />
            <div
              className="shimmer"
              style={{ width: 135, height: 36, borderRadius: 7 }}
            />
          </div>
        </header>

        <div className="rcp-kpi-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="rcp-kpi-card">
              <div style={{ width: "60%" }}>
                <div
                  className="shimmer"
                  style={{ width: "75%", height: 13, marginBottom: 10 }}
                />
                <div
                  className="shimmer"
                  style={{ width: "45%", height: 26 }}
                />
              </div>
              <div
                className="shimmer"
                style={{ width: 38, height: 38, borderRadius: 8 }}
              />
            </div>
          ))}
        </div>

        <div className="rcp-filter-panel">
          <div className="rcp-filter-top">
            <div
              className="shimmer"
              style={{ width: 340, height: 36, borderRadius: 7 }}
            />
            <div className="d-flex gap-2">
              <div
                className="shimmer"
                style={{ width: 140, height: 36, borderRadius: 7 }}
              />
              <div
                className="shimmer"
                style={{ width: 140, height: 36, borderRadius: 7 }}
              />
              <div
                className="shimmer"
                style={{ width: 110, height: 36, borderRadius: 7 }}
              />
            </div>
          </div>
          <div className="rcp-cat-tabs-bar">
            <div className="d-flex gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div
                  key={i}
                  className="shimmer"
                  style={{ width: 110, height: 32, borderRadius: 6 }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="rcp-cards-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rcp-card">
              <div
                className="shimmer"
                style={{ width: "100%", height: 178, borderRadius: 0 }}
              />
              <div className="rcp-card-body">
                <div
                  className="shimmer"
                  style={{ width: "75%", height: 16, marginBottom: 6 }}
                />
                <div
                  className="shimmer"
                  style={{ width: "45%", height: 12, marginBottom: 10 }}
                />
                <div className="d-flex gap-1 mb-2">
                  <div
                    className="shimmer"
                    style={{ width: 68, height: 22, borderRadius: 4 }}
                  />
                  <div
                    className="shimmer"
                    style={{ width: 76, height: 22, borderRadius: 4 }}
                  />
                </div>
                <div
                  className="shimmer"
                  style={{ width: "100%", height: 35, marginBottom: 10 }}
                />
                <div className="rcp-card-footer">
                  <div
                    className="shimmer"
                    style={{ width: 95, height: 16 }}
                  />
                  <div
                    className="shimmer"
                    style={{ width: 90, height: 28, borderRadius: 5 }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rcp-page">
      {/* Hidden input for quick 1-click photo replacement from any card */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleQuickPhotoFileSelected}
      />

      {/* Header */}
      <header className="rcp-header">
        <div>
          <h1 className="rcp-title">Recipe Directory</h1>
          <p className="rcp-subtitle">
            Browse, curate, batch-edit images & categories, and manage recipes.
          </p>
        </div>

        <div className="rcp-header-actions">
          <button
            type="button"
            className="rcp-btn"
            onClick={() => loadRecipeCatalog(true)}
            disabled={loading || syncingPages}
          >
            <RefreshCw
              size={14}
              className={loading || syncingPages ? "rcp-spin" : ""}
            />
            <span>
              {syncingPages ? `Syncing (${syncProgressPct}%)...` : "Refresh"}
            </span>
          </button>

          {paginatedRecipes.length > 0 && (
            <button
              type="button"
              className="rcp-btn"
              onClick={openBatchEditorForCurrentPage}
              title="Open Batch Editor for all recipes on this page to quickly fix images, titles, or categories"
            >
              <Edit2 size={14} />
              <span>Batch Edit Page ({paginatedRecipes.length})</span>
            </button>
          )}

          <Link to="/create-recipe" className="rcp-btn rcp-btn--primary">
            <Plus size={15} />
            <span>New Recipe</span>
          </Link>
        </div>
      </header>

      {/* KPI Summary Strip */}
      <section className="rcp-kpi-grid" aria-label="Recipe Metrics">
        <div className="rcp-kpi-card">
          <div>
            <div className="rcp-kpi-label">
              {hasActiveFilters ? "Matching Recipes" : "Total Recipes"}
            </div>
            <div className="rcp-kpi-value">
              {(hasActiveFilters
                ? totalFilteredCount
                : displayTotalCount
              ).toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                color: "#64748b",
                marginTop: 2,
              }}
            >
              {syncingPages
                ? `Syncing catalog (${syncProgressPct}%)`
                : hasActiveFilters
                  ? `of ${displayTotalCount.toLocaleString()} total recipes`
                  : duplicateMode === "unique" &&
                      catalogAnalysis.duplicateCount > 0
                    ? `${catalogAnalysis.duplicateCount.toLocaleString()} duplicates hidden`
                    : "Deduplicated catalog"}
            </div>
          </div>
          <div className="rcp-kpi-icon">
            <BookOpen size={18} />
          </div>
        </div>

        <div className="rcp-kpi-card">
          <div>
            <div className="rcp-kpi-label">Active Categories</div>
            <div className="rcp-kpi-value">
              {categoryStats.length.toLocaleString()}
            </div>
          </div>
          <div className="rcp-kpi-icon">
            <Tag size={18} />
          </div>
        </div>

        <div className="rcp-kpi-card">
          <div>
            <div className="rcp-kpi-label">Avg Cook Time</div>
            <div className="rcp-kpi-value">{avgCookTime}m</div>
          </div>
          <div className="rcp-kpi-icon">
            <Clock size={18} />
          </div>
        </div>

        <div className="rcp-kpi-card">
          <div>
            <div className="rcp-kpi-label">Average Rating</div>
            <div className="rcp-kpi-value">{avgRating}</div>
          </div>
          <div className="rcp-kpi-icon">
            <Star size={18} />
          </div>
        </div>
      </section>

      {/* Alert Banner */}
      {statusMsg && (
        <div
          className={`rcp-alert rcp-alert--${statusMsg.type || "success"}`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            {statusMsg.type === "danger" || statusMsg.type === "warning" ? (
              <AlertCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            <span>{statusMsg.text}</span>
          </div>
          <button
            type="button"
            className="rcp-btn rcp-btn--sm"
            onClick={() => setStatusMsg(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="rcp-filter-panel">
        <div className="rcp-filter-top">
          <div className="rcp-search-wrap">
            <Search size={15} className="rcp-search-icon" />
            <input
              type="text"
              placeholder="Search by recipe title, creator, or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rcp-input rcp-input--search"
            />
            {search && (
              <button
                type="button"
                className="rcp-search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="rcp-filter-controls">
            <select
              className="rcp-select rcp-filter-select"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">
                All Categories ({displayTotalCount.toLocaleString()})
              </option>
              {categoryStats.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.count})
                </option>
              ))}
            </select>

            <select
              className="rcp-select rcp-filter-select"
              value={duplicateMode}
              onChange={(e) => setDuplicateMode(e.target.value)}
              aria-label="Duplicate filter mode"
              title="Control how duplicate recipes are displayed"
            >
              <option value="unique">
                Unique Only ({catalogAnalysis.uniqueByTitle.length})
              </option>
              <option value="all">
                Include Duplicates ({catalogAnalysis.allRecipes.length})
              </option>
              {catalogAnalysis.duplicateCount > 0 && (
                <option value="duplicates">
                  Duplicates Only ({catalogAnalysis.duplicateCount})
                </option>
              )}
            </select>

            <select
              className="rcp-select rcp-filter-select"
              value={cookTimeFilter}
              onChange={(e) => setCookTimeFilter(e.target.value)}
              aria-label="Filter by cook time"
            >
              <option value="">Any Cook Time</option>
              <option value="quick">Quick (≤ 30 min)</option>
              <option value="medium">Medium (31–60 min)</option>
              <option value="long">Long (&gt; 60 min)</option>
            </select>

            <select
              className="rcp-select rcp-filter-select"
              style={{ minWidth: 120 }}
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              aria-label="Filter by minimum rating"
            >
              <option value="">Any Rating</option>
              <option value="4.5">4.5+ Stars</option>
              <option value="4">4.0+ Stars</option>
              <option value="3">3.0+ Stars</option>
            </select>

            <select
              className="rcp-select rcp-filter-select"
              style={{ minWidth: 140 }}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort recipes"
            >
              <option value="newest">Sort: Newest</option>
              <option value="name_asc">Sort: Title (A–Z)</option>
              <option value="time_asc">Sort: Fastest Time</option>
              <option value="rating_desc">Sort: Highest Rated</option>
            </select>

            <select
              className="rcp-select"
              style={{ width: 105 }}
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              aria-label="Items per page"
            >
              <option value={12}>12 / page</option>
              <option value={24}>24 / page</option>
              <option value={36}>36 / page</option>
              <option value={48}>48 / page</option>
            </select>

            <div
              className="rcp-view-toggle"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                className={`rcp-view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
                title="Grid view"
              >
                <LayoutGrid size={14} />
                <span>Grid</span>
              </button>
              <button
                type="button"
                className={`rcp-view-btn ${viewMode === "table" ? "active" : ""}`}
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <ListIcon size={14} />
                <span>Table</span>
              </button>
            </div>
          </div>
        </div>

        {/* Category Pills Bar with Live Recipe Counts */}
        {categoryStats.length > 0 && (
          <div className="rcp-cat-tabs-bar">
            <div className="rcp-cat-tabs" role="tablist">
              <button
                type="button"
                className={`rcp-cat-tab ${categoryFilter === "" ? "active" : ""}`}
                onClick={() => setCategoryFilter("")}
              >
                <span>All Categories</span>
                <span className="rcp-cat-tab-count">
                  {displayTotalCount.toLocaleString()}
                </span>
              </button>
              {categoryStats.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  className={`rcp-cat-tab ${
                    categoryFilter === cat.name ? "active" : ""
                  }`}
                  onClick={() =>
                    setCategoryFilter(
                      categoryFilter === cat.name ? "" : cat.name
                    )
                  }
                >
                  <span>{cat.name}</span>
                  <span className="rcp-cat-tab-count">
                    {cat.count.toLocaleString()}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active Filter Summary Strip */}
        {hasActiveFilters && (
          <div className="rcp-active-filters-strip">
            <div className="d-flex flex-wrap align-items-center gap-2">
              <span
                style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}
              >
                Active filters:
              </span>
              {search.trim() && (
                <span className="rcp-active-filter-chip">
                  <span>Search: "{search.trim()}"</span>
                  <button type="button" onClick={() => setSearch("")}>
                    ×
                  </button>
                </span>
              )}
              {categoryFilter && (
                <span className="rcp-active-filter-chip">
                  <span>Category: {categoryFilter}</span>
                  <button type="button" onClick={() => setCategoryFilter("")}>
                    ×
                  </button>
                </span>
              )}
              {duplicateMode === "duplicates" && (
                <span className="rcp-active-filter-chip">
                  <span>
                    Showing Duplicates Only ({catalogAnalysis.duplicateCount})
                  </span>
                  <button
                    type="button"
                    onClick={() => setDuplicateMode("unique")}
                  >
                    ×
                  </button>
                </span>
              )}
              {cookTimeFilter && (
                <span className="rcp-active-filter-chip">
                  <span>
                    Time:{" "}
                    {cookTimeFilter === "quick"
                      ? "≤ 30m"
                      : cookTimeFilter === "medium"
                        ? "31–60m"
                        : "> 60m"}
                  </span>
                  <button type="button" onClick={() => setCookTimeFilter("")}>
                    ×
                  </button>
                </span>
              )}
              {minRating && (
                <span className="rcp-active-filter-chip">
                  <span>Rating: {minRating}+ ★</span>
                  <button type="button" onClick={() => setMinRating("")}>
                    ×
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              className="rcp-btn rcp-btn--sm"
              onClick={resetAllFilters}
            >
              <X size={13} />
              <span>Clear All Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* Bulk Selection, Batch Edit & Top Pagination Bar */}
      {paginatedRecipes.length > 0 && (
        <div
          className={`rcp-bulk-bar ${
            selectedRecipeIds.length > 0 ? "rcp-bulk-bar--active" : ""
          }`}
        >
          <div className="rcp-bulk-left">
            <label className="rcp-checkbox-label">
              <input
                type="checkbox"
                className="rcp-checkbox"
                checked={
                  paginatedRecipes.length > 0 &&
                  paginatedRecipes.every((r) =>
                    selectedRecipeIds.includes(r.id)
                  )
                }
                onChange={() => toggleSelectAllOnPage(paginatedRecipes)}
              />
              <span>Select all on page ({paginatedRecipes.length})</span>
            </label>

            {selectedRecipeIds.length > 0 ? (
              <span className="rcp-selected-count-badge">
                {selectedRecipeIds.length}{" "}
                {selectedRecipeIds.length === 1 ? "recipe" : "recipes"} selected
              </span>
            ) : (
              <span className="rcp-results-summary">
                Showing <strong>{startItemNum}</strong>–
                <strong>{endItemNum}</strong> of{" "}
                <strong>{totalFilteredCount}</strong> recipes
              </span>
            )}
          </div>

          <div className="rcp-bulk-actions">
            {selectedRecipeIds.length > 0 ? (
              <>
                <button
                  type="button"
                  className="rcp-btn rcp-btn--sm"
                  onClick={() => setSelectedRecipeIds([])}
                >
                  Clear Selection
                </button>
                <button
                  type="button"
                  className="rcp-btn rcp-btn--sm rcp-btn--primary"
                  onClick={openBatchEditorForSelected}
                >
                  <Edit2 size={13} />
                  <span>Batch Edit Selected ({selectedRecipeIds.length})</span>
                </button>
                <button
                  type="button"
                  className="rcp-btn rcp-btn--sm rcp-btn--danger-solid"
                  onClick={() => setShowBulkDeleteConfirm(true)}
                >
                  <Trash2 size={13} />
                  <span>Delete Selected ({selectedRecipeIds.length})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rcp-btn rcp-btn--sm"
                  onClick={openBatchEditorForCurrentPage}
                >
                  <Edit2 size={13} />
                  <span>Batch Edit Page ({paginatedRecipes.length})</span>
                </button>

                {totalPages > 1 && (
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="rcp-page-btn"
                      disabled={safeCurrentPage === 1}
                      onClick={() => goToPage(safeCurrentPage - 1)}
                      title="Previous page"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "#475569",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      Page {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="rcp-page-btn"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() => goToPage(safeCurrentPage + 1)}
                      title="Next page"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area: Empty State, Spacious 3-Col Grid View, or Table View */}
      {paginatedRecipes.length === 0 ? (
        <div className="rcp-empty-state">
          <div className="rcp-empty-card">
            <div className="rcp-empty-icon-box">
              <Search size={20} />
            </div>
            <h3 className="rcp-empty-title">No matching recipes found</h3>
            <p className="rcp-empty-desc">
              {hasActiveFilters
                ? "No recipes matched your current search or filter selection."
                : "No recipes are currently available."}
            </p>
            <div className="d-flex gap-2 justify-content-center flex-wrap">
              {hasActiveFilters && (
                <button
                  type="button"
                  className="rcp-btn rcp-btn--primary"
                  onClick={resetAllFilters}
                >
                  <RefreshCw size={14} />
                  <span>Clear All Filters</span>
                </button>
              )}
              <Link to="/create-recipe" className="rcp-btn">
                <Plus size={14} />
                <span>Create New Recipe</span>
              </Link>
            </div>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="rcp-cards-grid">
          {paginatedRecipes.map((recipe) => {
            const categories = cleanCategoryList(
              recipe.category,
              activeCategoryLowerSet
            );
            const isSelected = selectedRecipeIds.includes(recipe.id);
            const isExpandedCats = expandedCardCatIds.includes(recipe.id);
            const visibleCategories = isExpandedCats
              ? categories
              : categories.slice(0, 2);
            const hiddenCatCount = Math.max(
              0,
              categories.length - visibleCategories.length
            );
            const isQuickUploading = quickUploadingRecipeId === recipe.id;

            return (
              <article
                key={recipe.id}
                className={`rcp-card ${isSelected ? "rcp-card--selected" : ""}`}
              >
                <div
                  className="rcp-card-media"
                  onClick={() => openDetail(recipe.id, false)}
                >
                  <label
                    className="rcp-card-select-box"
                    onClick={(e) => e.stopPropagation()}
                    title={
                      isSelected
                        ? "Deselect recipe"
                        : "Select recipe for batch edit or bulk delete"
                    }
                  >
                    <input
                      type="checkbox"
                      className="rcp-checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectRecipe(recipe.id)}
                    />
                  </label>

                  <button
                    type="button"
                    className="rcp-card-quick-img-btn"
                    onClick={(e) => triggerQuickPhotoUpload(recipe, e)}
                    disabled={isQuickUploading}
                    title={
                      isQuickUploading
                        ? "Uploading photo..."
                        : "Upload a new photo for this recipe"
                    }
                  >
                    <Upload size={13} />
                  </button>

                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.name}
                      className="rcp-card-img"
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="rcp-card-img-placeholder">
                      <ImageIcon size={20} />
                      <span>No image</span>
                    </div>
                  )}
                </div>

                <div className="rcp-card-body">
                  <h2
                    className="rcp-card-title"
                    onClick={() => openDetail(recipe.id, false)}
                    title={recipe.name}
                  >
                    {recipe.name}
                  </h2>

                  <div className="rcp-card-creator">
                    {recipe.creator_name
                      ? `By ${recipe.creator_name}`
                      : "By Cookeaze Kitchen"}
                  </div>

                  {/* Removable Category Tags Row */}
                  <div className="rcp-card-tags">
                    {categories.length > 0 ? (
                      <>
                        {visibleCategories.map((cat, idx) => (
                          <span
                            key={idx}
                            className="rcp-tag rcp-tag--removable"
                            title={cat}
                          >
                            <span>{cat}</span>
                            <button
                              type="button"
                              className="rcp-tag-remove-btn"
                              title={`Remove "${cat}" from ${recipe.name}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                quickRemoveCategoryFromRecipe(
                                  recipe,
                                  cat,
                                  false
                                );
                              }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        {hiddenCatCount > 0 && (
                          <button
                            type="button"
                            className="rcp-tag-more-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandCardCategories(recipe.id);
                            }}
                            title="Show all categories"
                          >
                            +{hiddenCatCount}
                          </button>
                        )}
                        {isExpandedCats && categories.length > 2 && (
                          <button
                            type="button"
                            className="rcp-tag-more-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpandCardCategories(recipe.id);
                            }}
                          >
                            Less
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 11 }}>
                        No categories
                      </span>
                    )}
                  </div>

                  {/* Neat 3-Line Description (never cuts mid-line) */}
                  <p className="rcp-card-desc">
                    {recipe.description || "No description provided."}
                  </p>

                  {/* Compact Card Footer */}
                  <div className="rcp-card-footer">
                    <div className="rcp-card-metrics">
                      <span className="rcp-metric-item" title="Cook time">
                        <Clock size={12} />
                        <span>{recipe.total_time || 0}m</span>
                      </span>
                      <span className="rcp-metric-item" title="Servings">
                        <Users size={12} />
                        <span>{recipe.servings || 1}</span>
                      </span>
                      <span className="rcp-metric-item" title="Rating">
                        <Star size={12} />
                        <span>{recipe.rating || "0.0"}</span>
                      </span>
                    </div>

                    <div className="rcp-card-actions">
                      <button
                        type="button"
                        className="rcp-btn rcp-card-btn-view"
                        onClick={() => openDetail(recipe.id, false)}
                      >
                        View
                      </button>
                      <button
                        type="button"
                        className="rcp-btn rcp-card-btn-icon"
                        onClick={() => openDetail(recipe.id, true)}
                        title="Edit recipe"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        type="button"
                        className="rcp-btn rcp-card-btn-icon rcp-btn--danger"
                        onClick={() => setConfirmDeleteId(recipe.id)}
                        title="Delete recipe"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rcp-table-panel">
          <div className="rcp-table-wrap">
            <table className="rcp-table">
              <thead>
                <tr>
                  <th style={{ width: 42 }}>
                    <input
                      type="checkbox"
                      className="rcp-checkbox"
                      checked={
                        paginatedRecipes.length > 0 &&
                        paginatedRecipes.every((r) =>
                          selectedRecipeIds.includes(r.id)
                        )
                      }
                      onChange={() => toggleSelectAllOnPage(paginatedRecipes)}
                      aria-label="Select all recipes on page"
                    />
                  </th>
                  <th>Recipe</th>
                  <th>Categories</th>
                  <th>Creator</th>
                  <th>Time</th>
                  <th>Servings</th>
                  <th>Rating</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecipes.map((recipe) => {
                  const categories = cleanCategoryList(
                    recipe.category,
                    activeCategoryLowerSet
                  );
                  const isSelected = selectedRecipeIds.includes(recipe.id);
                  return (
                    <tr
                      key={recipe.id}
                      className={isSelected ? "rcp-table-row--selected" : ""}
                    >
                      <td>
                        <input
                          type="checkbox"
                          className="rcp-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectRecipe(recipe.id)}
                          aria-label={`Select ${recipe.name}`}
                        />
                      </td>
                      <td>
                        <div className="rcp-table-recipe-cell">
                          {recipe.image_url ? (
                            <img
                              src={recipe.image_url}
                              alt={recipe.name}
                              className="rcp-table-thumb"
                              loading="lazy"
                            />
                          ) : (
                            <div className="rcp-table-thumb d-flex align-items-center justify-content-center text-muted">
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <div>
                            <div
                              className="rcp-table-name"
                              onClick={() => openDetail(recipe.id, false)}
                            >
                              {recipe.name}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap gap-1">
                          {categories.length > 0 ? (
                            categories.map((c, idx) => (
                              <span
                                key={idx}
                                className="rcp-tag rcp-tag--removable"
                              >
                                <span>{c}</span>
                                <button
                                  type="button"
                                  className="rcp-tag-remove-btn"
                                  title={`Remove "${c}" from ${recipe.name}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    quickRemoveCategoryFromRecipe(
                                      recipe,
                                      c,
                                      false
                                    );
                                  }}
                                >
                                  ×
                                </button>
                              </span>
                            ))
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </div>
                      </td>
                      <td style={{ color: "#475569" }}>
                        {recipe.creator_name || "—"}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {recipe.total_time || 0}m
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {recipe.servings || 1}
                      </td>
                      <td style={{ fontVariantNumeric: "tabular-nums" }}>
                        {recipe.rating || "—"}
                      </td>
                      <td>
                        <div className="d-flex justify-content-end gap-1">
                          <button
                            type="button"
                            className="rcp-btn rcp-btn--sm"
                            onClick={() => openDetail(recipe.id, false)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="rcp-btn rcp-btn--icon"
                            onClick={() => openDetail(recipe.id, true)}
                            title="Edit recipe"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            className="rcp-btn rcp-btn--icon rcp-btn--danger"
                            onClick={() => setConfirmDeleteId(recipe.id)}
                            title="Delete recipe"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bottom Pagination Bar with Page Jump */}
      {totalFilteredCount > 0 && (
        <div className="rcp-pagination-bar">
          <div className="rcp-pagination-info">
            Showing <strong>{startItemNum}</strong>–
            <strong>{endItemNum}</strong> of{" "}
            <strong>{totalFilteredCount.toLocaleString()}</strong>{" "}
            {hasActiveFilters ? "filtered recipes" : "total recipes"} (Page{" "}
            <strong>{safeCurrentPage}</strong> of{" "}
            <strong>{totalPages}</strong>)
          </div>

          <div className="rcp-pagination-controls">
            {totalPages > 1 && (
              <>
                <nav aria-label="Recipe pagination">
                  <ul className="rcp-pagination-list">
                    <li>
                      <button
                        type="button"
                        className="rcp-page-btn"
                        disabled={safeCurrentPage === 1}
                        onClick={() => goToPage(1)}
                      >
                        First
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="rcp-page-btn"
                        disabled={safeCurrentPage === 1}
                        onClick={() => goToPage(safeCurrentPage - 1)}
                      >
                        <ChevronLeft size={14} />
                      </button>
                    </li>

                    {paginationRange().map((p, idx) =>
                      p === "..." ? (
                        <li key={`dots-${idx}`}>
                          <span
                            className="rcp-page-btn"
                            style={{ border: "none" }}
                          >
                            …
                          </span>
                        </li>
                      ) : (
                        <li key={p}>
                          <button
                            type="button"
                            className={`rcp-page-btn ${
                              p === safeCurrentPage ? "active" : ""
                            }`}
                            onClick={() => goToPage(p)}
                          >
                            {p}
                          </button>
                        </li>
                      )
                    )}

                    <li>
                      <button
                        type="button"
                        className="rcp-page-btn"
                        disabled={safeCurrentPage === totalPages}
                        onClick={() => goToPage(safeCurrentPage + 1)}
                      >
                        <ChevronRight size={14} />
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className="rcp-page-btn"
                        disabled={safeCurrentPage === totalPages}
                        onClick={() => goToPage(totalPages)}
                      >
                        Last
                      </button>
                    </li>
                  </ul>
                </nav>

                <select
                  className="rcp-select rcp-page-jump-select"
                  value={safeCurrentPage}
                  onChange={(e) => goToPage(Number(e.target.value))}
                  aria-label="Jump to page"
                >
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (pageNum) => (
                      <option key={pageNum} value={pageNum}>
                        Go to Page {pageNum}
                      </option>
                    )
                  )}
                </select>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Batch Recipe Editor Modal (Edit Multiple Recipes Batch-by-Batch & Fix Bad Images) ===== */}
      {showBatchEditModal && (
        <div
          className="rcp-modal-backdrop"
          onClick={() => !batchSavingAll && setShowBatchEditModal(false)}
        >
          <div
            className="rcp-modal rcp-modal--xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rcp-modal-header">
              <div>
                <h2 className="rcp-modal-title">
                  Batch Edit Recipes ({batchDrafts.length}{" "}
                  {batchDrafts.length === 1 ? "recipe" : "recipes"})
                </h2>
                <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                  Replace bad recipe images, update titles/times, or add/remove
                  categories across this batch and save all at once.
                </div>
              </div>

              <div className="d-flex align-items-center gap-2">
                {totalPages > 1 && selectedRecipeIds.length === 0 && (
                  <div className="d-flex align-items-center gap-1">
                    <button
                      type="button"
                      className="rcp-btn rcp-btn--sm"
                      disabled={safeCurrentPage === 1 || batchSavingAll}
                      onClick={() =>
                        switchBatchEditorToPage(safeCurrentPage - 1)
                      }
                    >
                      <ChevronLeft size={13} />
                      <span>Prev Batch</span>
                    </button>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "0 8px",
                        color: "#475569",
                      }}
                    >
                      Batch {safeCurrentPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className="rcp-btn rcp-btn--sm"
                      disabled={
                        safeCurrentPage === totalPages || batchSavingAll
                      }
                      onClick={() =>
                        switchBatchEditorToPage(safeCurrentPage + 1)
                      }
                    >
                      <span>Next Batch</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="rcp-btn rcp-btn--icon"
                  onClick={() => setShowBatchEditModal(false)}
                  disabled={batchSavingAll}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="rcp-modal-body">
              {/* Batch-wide Category Action Bar */}
              <div className="rcp-batch-Category-toolbar">
                <div className="d-flex align-items-center gap-2 flex-wrap">
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    Bulk Category Action for this Batch:
                  </span>
                  <select
                    className="rcp-select"
                    style={{ width: 200, height: 32, fontSize: 12.5 }}
                    value={batchCategoryToApply}
                    onChange={(e) => setBatchCategoryToApply(e.target.value)}
                  >
                    <option value="">Select a category...</option>
                    {availableCategories.map((c) => (
                      <option key={c.id} value={c.category_name}>
                        {c.category_name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="rcp-btn rcp-btn--sm rcp-btn--primary"
                    disabled={!batchCategoryToApply}
                    onClick={() => applyCategoryToEntireBatch("add")}
                  >
                    + Add to All ({batchDrafts.length})
                  </button>
                  <button
                    type="button"
                    className="rcp-btn rcp-btn--sm rcp-btn--danger"
                    disabled={!batchCategoryToApply}
                    onClick={() => applyCategoryToEntireBatch("remove")}
                  >
                    − Remove from All ({batchDrafts.length})
                  </button>
                </div>

                {dirtyBatchCount > 0 && (
                  <span className="rcp-selected-count-badge">
                    {dirtyBatchCount} modified in batch
                  </span>
                )}
              </div>

              {/* Scrollable List of Recipes in Current Batch */}
              <div className="rcp-batch-list">
                {batchDrafts.map((draft, idx) => {
                  const isUploadingThis = Boolean(batchUploadingMap[draft.id]);
                  const isSavingThis = Boolean(batchSavingMap[draft.id]);

                  return (
                    <div
                      key={draft.id}
                      className={`rcp-batch-item ${
                        draft.dirty ? "rcp-batch-item--dirty" : ""
                      }`}
                    >
                      {/* Left Column: Image Preview + Upload + Paste URL */}
                      <div className="rcp-batch-img-col">
                        <div className="rcp-batch-thumb-wrap">
                          {draft.image_url ? (
                            <img
                              src={draft.image_url}
                              alt={draft.name}
                              className="rcp-batch-thumb"
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="rcp-card-img-placeholder">
                              <ImageIcon size={20} />
                              <span>Bad / Missing Image</span>
                            </div>
                          )}
                        </div>

                        <label
                          className="rcp-btn rcp-btn--sm w-100"
                          style={{ cursor: "pointer", margin: 0 }}
                        >
                          <Upload size={12} />
                          <span>
                            {isUploadingThis
                              ? "Uploading..."
                              : "Upload New Image"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            disabled={isUploadingThis}
                            onChange={(e) =>
                              handleBatchImageUpload(
                                draft.id,
                                e.target.files?.[0]
                              )
                            }
                          />
                        </label>

                        <input
                          type="url"
                          className="rcp-input"
                          style={{ height: 30, fontSize: 11.5 }}
                          placeholder="Or paste image URL..."
                          value={draft.image_url || ""}
                          onChange={(e) =>
                            updateBatchDraftField(
                              draft.id,
                              "image_url",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      {/* Right Column: Title, Time, Servings, Rating, Categories */}
                      <div className="rcp-batch-fields-col">
                        <div className="rcp-batch-top-row">
                          <div>
                            <label className="rcp-field-label">
                              #{idx + 1} Recipe Title
                            </label>
                            <input
                              type="text"
                              className="rcp-input"
                              value={draft.name}
                              onChange={(e) =>
                                updateBatchDraftField(
                                  draft.id,
                                  "name",
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div>
                            <label className="rcp-field-label">Time (m)</label>
                            <input
                              type="number"
                              className="rcp-input"
                              value={draft.total_time}
                              onChange={(e) =>
                                updateBatchDraftField(
                                  draft.id,
                                  "total_time",
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>

                          <div>
                            <label className="rcp-field-label">Servings</label>
                            <input
                              type="number"
                              className="rcp-input"
                              value={draft.servings}
                              onChange={(e) =>
                                updateBatchDraftField(
                                  draft.id,
                                  "servings",
                                  Number(e.target.value)
                                )
                              }
                            />
                          </div>

                          <div>
                            <label className="rcp-field-label">Rating</label>
                            <input
                              type="text"
                              className="rcp-input"
                              value={draft.rating}
                              onChange={(e) =>
                                updateBatchDraftField(
                                  draft.id,
                                  "rating",
                                  e.target.value
                                )
                              }
                            />
                          </div>

                          <div>
                            <button
                              type="button"
                              className={`rcp-btn rcp-btn--sm ${
                                draft.dirty ? "rcp-btn--primary" : ""
                              }`}
                              style={{ height: 36 }}
                              disabled={isSavingThis || isUploadingThis}
                              onClick={() => saveSingleBatchDraft(draft)}
                            >
                              <Save size={13} />
                              <span>
                                {isSavingThis
                                  ? "Saving..."
                                  : draft.dirty
                                    ? "Save Row"
                                    : "Saved"}
                              </span>
                            </button>
                          </div>
                        </div>

                        {/* Categories Strip for this Recipe */}
                        <div className="rcp-batch-cats-row">
                          <div className="d-flex flex-wrap align-items-center gap-1">
                            <span
                              style={{
                                fontSize: 11.5,
                                fontWeight: 700,
                                color: "#64748b",
                                marginRight: 4,
                              }}
                            >
                              Categories:
                            </span>
                            {(draft.category || []).length > 0 ? (
                              (draft.category || []).map((c, cIdx) => (
                                <span
                                  key={cIdx}
                                  className="rcp-active-cat-chip"
                                >
                                  <span>{c}</span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      removeCategoryFromBatchDraft(draft.id, c)
                                    }
                                    title={`Remove ${c}`}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span
                                className="text-muted"
                                style={{ fontSize: 12 }}
                              >
                                None assigned
                              </span>
                            )}
                          </div>

                          <div className="d-flex align-items-center gap-1">
                            <select
                              className="rcp-select"
                              style={{ width: 165, height: 28, fontSize: 12 }}
                              value=""
                              onChange={(e) => {
                                addCategoryToBatchDraft(
                                  draft.id,
                                  e.target.value
                                );
                              }}
                            >
                              <option value="">+ Add category...</option>
                              {availableCategories.map((cat) => (
                                <option
                                  key={cat.id}
                                  value={cat.category_name}
                                >
                                  {cat.category_name}
                                </option>
                              ))}
                            </select>

                            {(draft.category || []).length > 0 && (
                              <button
                                type="button"
                                className="rcp-btn rcp-btn--sm rcp-btn--danger"
                                style={{ height: 28, padding: "0 8px", fontSize: 11.5 }}
                                onClick={() =>
                                  updateBatchDraftField(draft.id, "category", [])
                                }
                              >
                                Clear All
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rcp-modal-footer">
              <div className="text-muted small">
                {dirtyBatchCount > 0
                  ? `${dirtyBatchCount} recipe(s) have unsaved changes in this batch.`
                  : "All recipes in this batch are up to date."}
              </div>

              <div className="d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="rcp-btn"
                  onClick={() => setShowBatchEditModal(false)}
                  disabled={batchSavingAll}
                >
                  Close
                </button>

                {totalPages > 1 &&
                  selectedRecipeIds.length === 0 &&
                  safeCurrentPage < totalPages && (
                    <button
                      type="button"
                      className="rcp-btn"
                      onClick={() => saveAllBatchDrafts(true)}
                      disabled={batchSavingAll}
                    >
                      <Save size={14} />
                      <span>Save &amp; Load Next Batch →</span>
                    </button>
                  )}

                <button
                  type="button"
                  className="rcp-btn rcp-btn--primary"
                  onClick={() => saveAllBatchDrafts(false)}
                  disabled={batchSavingAll}
                >
                  <Save size={14} />
                  <span>
                    {batchSavingAll
                      ? "Saving Batch..."
                      : `Save All Batch Changes (${
                          dirtyBatchCount > 0
                            ? dirtyBatchCount
                            : batchDrafts.length
                        })`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recipe Detail & Edit Modal */}
      {selectedId && (
        <div className="rcp-modal-backdrop" onClick={closeModal}>
          <div className="rcp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rcp-modal-header">
              <h2 className="rcp-modal-title">
                {detailLoading
                  ? "Loading Recipe..."
                  : detail?.name || "Recipe Details"}
              </h2>
              <div className="d-flex align-items-center gap-2">
                {!detailLoading && detail && !isEditing && (
                  <button
                    type="button"
                    className="rcp-btn rcp-btn--sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Edit2 size={13} />
                    <span>Edit Recipe</span>
                  </button>
                )}
                <button
                  type="button"
                  className="rcp-btn rcp-btn--icon"
                  onClick={closeModal}
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="rcp-modal-body">
              {detailLoading ? (
                <div>
                  <div className="rcp-modal-top-grid">
                    <div>
                      <div
                        className="shimmer"
                        style={{ width: "65%", height: 36, marginBottom: 16 }}
                      />
                      <div
                        className="shimmer"
                        style={{ width: "100%", height: 64, marginBottom: 16 }}
                      />
                      <div className="rcp-stats-row">
                        <div className="shimmer" style={{ height: 36 }} />
                        <div className="shimmer" style={{ height: 36 }} />
                        <div className="shimmer" style={{ height: 36 }} />
                      </div>
                      <div
                        className="shimmer"
                        style={{ width: "100%", height: 80 }}
                      />
                    </div>
                    <div>
                      <div
                        className="shimmer"
                        style={{ width: "100%", height: 220, borderRadius: 10 }}
                      />
                    </div>
                  </div>
                  <div className="rcp-sub-columns">
                    <div
                      className="shimmer"
                      style={{ width: "100%", height: 200, borderRadius: 10 }}
                    />
                    <div
                      className="shimmer"
                      style={{ width: "100%", height: 200, borderRadius: 10 }}
                    />
                  </div>
                </div>
              ) : detail ? (
                <>
                  <div className="rcp-modal-top-grid">
                    <div>
                      <div className="rcp-field-group">
                        <label className="rcp-field-label">Recipe Title</label>
                        <input
                          type="text"
                          className="rcp-input"
                          value={detail.name || ""}
                          onChange={(e) =>
                            setDetail({ ...detail, name: e.target.value })
                          }
                          readOnly={!isEditing}
                        />
                      </div>

                      <div className="rcp-field-group">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="rcp-field-label mb-0">
                            Categories{" "}
                            {isEditing &&
                              `(${(detail.category || []).length} selected)`}
                          </label>
                          {isEditing && (detail.category || []).length > 0 && (
                            <button
                              type="button"
                              className="rcp-btn rcp-btn--sm rcp-btn--danger"
                              style={{
                                height: 24,
                                padding: "0 8px",
                                fontSize: 11.5,
                              }}
                              onClick={clearAllModalCategories}
                            >
                              Remove All Categories
                            </button>
                          )}
                        </div>

                        {isEditing ? (
                          <div>
                            {(detail.category || []).length > 0 ? (
                              <div className="rcp-selected-cats-bar">
                                {(detail.category || []).map((catName, idx) => (
                                  <span
                                    key={idx}
                                    className="rcp-active-cat-chip"
                                  >
                                    <span>{catName}</span>
                                    <button
                                      type="button"
                                      onClick={() => toggleCategory(catName)}
                                      title={`Remove ${catName}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div
                                className="rcp-selected-cats-bar"
                                style={{ color: "#64748b", fontSize: 12.5 }}
                              >
                                No categories selected. Click any category below
                                to assign it.
                              </div>
                            )}

                            <div className="rcp-cat-search-row">
                              <input
                                type="text"
                                className="rcp-input"
                                style={{ height: 32, fontSize: 12.5 }}
                                placeholder="Filter categories by name..."
                                value={categorySearchModal}
                                onChange={(e) =>
                                  setCategorySearchModal(e.target.value)
                                }
                              />
                              {categorySearchModal && (
                                <button
                                  type="button"
                                  className="rcp-btn rcp-btn--sm"
                                  onClick={() => setCategorySearchModal("")}
                                >
                                  Clear
                                </button>
                              )}
                            </div>

                            <div className="rcp-category-picker">
                              {availableCategories.length === 0 ? (
                                <div className="text-muted small">
                                  Loading categories...
                                </div>
                              ) : (
                                [...availableCategories]
                                  .filter((cat) =>
                                    !categorySearchModal.trim()
                                      ? true
                                      : (cat.category_name || "")
                                          .toLowerCase()
                                          .includes(
                                            categorySearchModal
                                              .trim()
                                              .toLowerCase()
                                          )
                                  )
                                  .sort((a, b) => {
                                    const aChecked = (
                                      detail.category || []
                                    ).includes(a.category_name);
                                    const bChecked = (
                                      detail.category || []
                                    ).includes(b.category_name);
                                    if (aChecked !== bChecked)
                                      return aChecked ? -1 : 1;
                                    return (a.category_name || "").localeCompare(
                                      b.category_name || ""
                                    );
                                  })
                                  .map((cat) => {
                                    const isChecked = (
                                      detail.category || []
                                    ).includes(cat.category_name);
                                    return (
                                      <div
                                        key={cat.id}
                                        className={`rcp-category-option ${
                                          isChecked ? "selected" : ""
                                        }`}
                                        onClick={() =>
                                          toggleCategory(cat.category_name)
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() =>
                                            toggleCategory(cat.category_name)
                                          }
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        <span className="text-truncate">
                                          {cat.category_name}
                                        </span>
                                      </div>
                                    );
                                  })
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="d-flex flex-wrap gap-1">
                            {(detail.category || []).length > 0 ? (
                              (detail.category || []).map((c, i) => (
                                <span
                                  key={i}
                                  className="rcp-tag rcp-tag--removable"
                                >
                                  <span>{c}</span>
                                  <button
                                    type="button"
                                    className="rcp-tag-remove-btn"
                                    title={`Remove "${c}" from this recipe`}
                                    onClick={() =>
                                      quickRemoveCategoryFromRecipe(
                                        detail,
                                        c,
                                        true
                                      )
                                    }
                                  >
                                    ×
                                  </button>
                                </span>
                              ))
                            ) : (
                              <span className="text-muted small">
                                No categories assigned
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="rcp-stats-row">
                        <div>
                          <label className="rcp-field-label">
                            Total Time (min)
                          </label>
                          <input
                            type="number"
                            className="rcp-input"
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

                        <div>
                          <label className="rcp-field-label">Servings</label>
                          <input
                            type="number"
                            className="rcp-input"
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

                        <div>
                          <label className="rcp-field-label">Rating</label>
                          <input
                            type="text"
                            className="rcp-input"
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

                      <div className="rcp-field-group mb-0">
                        <label className="rcp-field-label">Description</label>
                        <textarea
                          className="rcp-textarea"
                          rows={3}
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

                    {/* Right Column: Image */}
                    <div>
                      <label className="rcp-field-label">Recipe Artwork</label>
                      <div className="rcp-image-box">
                        {imagePreview ? (
                          <img
                            src={imagePreview}
                            alt={detail.name}
                            className="rcp-image-preview"
                          />
                        ) : (
                          <div className="rcp-card-img-placeholder">
                            <ImageIcon size={24} />
                            <span>No image available</span>
                          </div>
                        )}
                      </div>

                      {isEditing && (
                        <div>
                          <div className="rcp-view-toggle mb-2">
                            <button
                              type="button"
                              className={`rcp-view-btn ${
                                imageMode === "upload" ? "active" : ""
                              }`}
                              onClick={() => {
                                setImageMode("upload");
                                setImageUrlInput("");
                                setImagePreview(detail?.image_url || null);
                              }}
                            >
                              Upload File
                            </button>
                            <button
                              type="button"
                              className={`rcp-view-btn ${
                                imageMode === "url" ? "active" : ""
                              }`}
                              onClick={() => {
                                setImageMode("url");
                                setImagePreview(detail?.image_url || null);
                                setImageUrlInput(detail?.image_url || "");
                              }}
                            >
                              Paste URL
                            </button>
                          </div>

                          {imageMode === "upload" ? (
                            <div>
                              <input
                                type="file"
                                accept="image/*"
                                className="rcp-input mb-1"
                                disabled={uploadingImage}
                                onChange={(e) =>
                                  handleImageFileChange(e.target.files?.[0])
                                }
                              />
                              <small className="text-muted d-block">
                                {uploadingImage
                                  ? "Uploading to Cloudinary..."
                                  : "Select an image to upload immediately."}
                              </small>
                            </div>
                          ) : (
                            <div>
                              <input
                                type="url"
                                className="rcp-input mb-2"
                                placeholder="https://..."
                                value={imageUrlInput}
                                onChange={(e) =>
                                  handleImageUrlChange(e.target.value)
                                }
                                disabled={uploadingImage}
                              />
                              <div className="d-flex gap-2">
                                <button
                                  type="button"
                                  className="rcp-btn rcp-btn--sm"
                                  onClick={() =>
                                    handleImageUrlChange(
                                      detail?.image_url || ""
                                    )
                                  }
                                  disabled={uploadingImage}
                                >
                                  Reset to Original
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ingredients & Steps Columns */}
                  <div className="rcp-sub-columns">
                    {/* Ingredients Panel */}
                    <div className="rcp-sub-panel">
                      <div className="rcp-sub-panel-header">
                        <h3 className="rcp-sub-panel-title">
                          Ingredients ({(detail.ingredients || []).length})
                        </h3>
                        {isEditing && (
                          <button
                            type="button"
                            className="rcp-btn rcp-btn--sm rcp-btn--primary"
                            onClick={addIngredient}
                          >
                            <Plus size={13} />
                            <span>Add Ingredient</span>
                          </button>
                        )}
                      </div>

                      <div className="rcp-sub-panel-body">
                        {(detail.ingredients || []).length === 0 ? (
                          <div className="text-muted small">
                            No ingredients listed.
                          </div>
                        ) : (
                          (detail.ingredients || []).map((ing) => (
                            <div key={ing.id} className="rcp-list-item">
                              {isEditing ? (
                                <>
                                  <div className="d-flex gap-2 mb-2">
                                    <input
                                      type="text"
                                      className="rcp-input"
                                      placeholder="Qty (e.g. 2)"
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
                                      type="text"
                                      className="rcp-input"
                                      placeholder="Unit (e.g. cups)"
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
                                      type="text"
                                      className="rcp-input"
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
                                      type="button"
                                      className="rcp-btn rcp-btn--icon rcp-btn--danger"
                                      onClick={() => removeIngredient(ing.id)}
                                      title="Remove ingredient"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div className="d-flex justify-content-between align-items-center gap-2">
                                  <span
                                    style={{
                                      fontSize: 13.5,
                                      fontWeight: 600,
                                      color: "#0f172a",
                                    }}
                                  >
                                    {ing.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 12.5,
                                      color: "#475569",
                                      fontVariantNumeric: "tabular-nums",
                                    }}
                                  >
                                    {ing.quantity || ""} {ing.unit || ""}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Steps Panel */}
                    <div className="rcp-sub-panel">
                      <div className="rcp-sub-panel-header">
                        <h3 className="rcp-sub-panel-title">
                          Preparation Steps ({(detail.steps || []).length})
                        </h3>
                        {isEditing && (
                          <button
                            type="button"
                            className="rcp-btn rcp-btn--sm rcp-btn--primary"
                            onClick={addStep}
                          >
                            <Plus size={13} />
                            <span>Add Step</span>
                          </button>
                        )}
                      </div>

                      <div className="rcp-sub-panel-body">
                        {(detail.steps || []).length === 0 ? (
                          <div className="text-muted small">
                            No preparation steps listed.
                          </div>
                        ) : (
                          (detail.steps || []).map((s, idx) => (
                            <div key={s.id} className="rcp-list-item">
                              {isEditing ? (
                                <>
                                  <div className="d-flex gap-2 mb-2">
                                    <input
                                      type="number"
                                      className="rcp-input"
                                      style={{ width: 80 }}
                                      value={s.step_number || idx + 1}
                                      onChange={(e) =>
                                        updateStep(
                                          s.id,
                                          "step_number",
                                          Number(e.target.value)
                                        )
                                      }
                                      title="Step number"
                                    />
                                    <select
                                      className="rcp-select"
                                      style={{ width: 130 }}
                                      value={s.step_type || "prep"}
                                      onChange={(e) =>
                                        updateStep(
                                          s.id,
                                          "step_type",
                                          e.target.value
                                        )
                                      }
                                    >
                                      <option value="prep">Prep</option>
                                      <option value="cook">Cook</option>
                                      <option value="serve">Serve</option>
                                    </select>
                                    <input
                                      type="number"
                                      className="rcp-input"
                                      style={{ width: 95 }}
                                      placeholder="Min"
                                      value={s.duration || 0}
                                      onChange={(e) =>
                                        updateStep(
                                          s.id,
                                          "duration",
                                          Number(e.target.value)
                                        )
                                      }
                                      title="Duration (minutes)"
                                    />
                                  </div>
                                  <div className="d-flex gap-2">
                                    <textarea
                                      className="rcp-textarea"
                                      rows={2}
                                      placeholder="Describe this step..."
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
                                      type="button"
                                      className="rcp-btn rcp-btn--icon rcp-btn--danger"
                                      onClick={() => removeStep(s.id)}
                                      title="Remove step"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <div>
                                  <div className="rcp-step-badge">
                                    <span>
                                      Step {s.step_number || idx + 1}
                                    </span>
                                    {s.step_type && (
                                      <span>• {s.step_type}</span>
                                    )}
                                    {Number(s.duration) > 0 && (
                                      <span>• {s.duration}m</span>
                                    )}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 13.5,
                                      lineHeight: 1.5,
                                      color: "#334155",
                                    }}
                                  >
                                    {s.description}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-muted text-center py-4">
                  Recipe details could not be loaded.
                </div>
              )}
            </div>

            <div className="rcp-modal-footer">
              <div className="text-muted small">
                {isEditing
                  ? uploadingImage
                    ? "Uploading image to Cloudinary..."
                    : "Editing mode active"
                  : detail?.creator_name
                    ? `Created by ${detail.creator_name}`
                    : "Read-only view"}
              </div>

              <div className="d-flex align-items-center gap-2">
                {!detailLoading && detail && (
                  <>
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="rcp-btn rcp-btn--danger"
                          onClick={() => setConfirmDeleteId(detail.id)}
                          disabled={uploadingImage || savingEdits}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                        <button
                          type="button"
                          className="rcp-btn"
                          onClick={() => {
                            setIsEditing(false);
                            openDetail(detail.id, false);
                          }}
                          disabled={uploadingImage || savingEdits}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="rcp-btn rcp-btn--primary"
                          onClick={saveEdits}
                          disabled={uploadingImage || savingEdits}
                        >
                          <Save size={14} />
                          <span>
                            {savingEdits ? "Saving..." : "Save Changes"}
                          </span>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="rcp-btn rcp-btn--danger"
                          onClick={() => setConfirmDeleteId(detail.id)}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                        <button
                          type="button"
                          className="rcp-btn rcp-btn--primary"
                          onClick={() => setIsEditing(true)}
                        >
                          <Edit2 size={14} />
                          <span>Edit Recipe</span>
                        </button>
                      </>
                    )}
                  </>
                )}

                <button
                  type="button"
                  className="rcp-btn"
                  onClick={closeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div
          className="rcp-modal-backdrop"
          onClick={() => !deletingRecipe && setConfirmDeleteId(null)}
        >
          <div
            className="rcp-modal rcp-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rcp-modal-header">
              <h3 className="rcp-modal-title">Delete Recipe</h3>
              <button
                type="button"
                className="rcp-btn rcp-btn--icon"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingRecipe}
              >
                <X size={16} />
              </button>
            </div>
            <div className="rcp-modal-body">
              <p className="mb-0" style={{ fontSize: 14, color: "#475569" }}>
                Are you sure you want to permanently delete this recipe? This
                action cannot be undone.
              </p>
            </div>
            <div className="rcp-modal-footer justify-content-end">
              <button
                type="button"
                className="rcp-btn"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingRecipe}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rcp-btn rcp-btn--danger-solid"
                onClick={confirmDeleteRecipe}
                disabled={deletingRecipe}
              >
                {deletingRecipe ? "Deleting..." : "Delete Recipe"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div
          className="rcp-modal-backdrop"
          onClick={() => !bulkDeleting && setShowBulkDeleteConfirm(false)}
        >
          <div
            className="rcp-modal rcp-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rcp-modal-header">
              <h3 className="rcp-modal-title">
                Delete {selectedRecipeIds.length}{" "}
                {selectedRecipeIds.length === 1 ? "Recipe" : "Recipes"}
              </h3>
              <button
                type="button"
                className="rcp-btn rcp-btn--icon"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                <X size={16} />
              </button>
            </div>
            <div className="rcp-modal-body">
              <p className="mb-0" style={{ fontSize: 14, color: "#475569" }}>
                Are you sure you want to permanently delete{" "}
                <strong>{selectedRecipeIds.length}</strong> selected{" "}
                {selectedRecipeIds.length === 1 ? "recipe" : "recipes"}? This
                action cannot be undone.
              </p>
            </div>
            <div className="rcp-modal-footer justify-content-end">
              <button
                type="button"
                className="rcp-btn"
                onClick={() => setShowBulkDeleteConfirm(false)}
                disabled={bulkDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rcp-btn rcp-btn--danger-solid"
                onClick={confirmBulkDelete}
                disabled={bulkDeleting}
              >
                {bulkDeleting
                  ? `Deleting ${selectedRecipeIds.length}...`
                  : `Delete ${selectedRecipeIds.length} ${
                      selectedRecipeIds.length === 1 ? "Recipe" : "Recipes"
                    }`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeList;
