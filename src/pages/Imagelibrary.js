import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Image as ImageIcon,
  Upload,
  Search,
  Tag,
  Trash2,
  Edit3,
  Copy,
  Check,
  X,
  Plus,
  RefreshCw,
  Grid,
  List,
  Layers,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Link2,
  Sparkles,
} from "lucide-react";
import { axiosInstance } from "../api";
import CloudinaryService from "../components/cloudinaryService";
import "./Imagelibrary.css";

// ============================================================
// REAL BACKEND ENDPOINT: https://api.cookeaze.app/api/food-images/
// ============================================================
const FOOD_IMAGES_API = "https://api.cookeaze.app/api/food-images/";
const CATALOG_CACHE_KEY = "cookeaze_food_images_catalog_v3";

// Purge any old caches so fresh backend payload is inspected
try {
  localStorage.removeItem("cookeaze_image_library_v4");
  localStorage.removeItem("cookeaze_dedicated_image_library_v1");
  localStorage.removeItem("cookeaze_image_library_v2");
  localStorage.removeItem("cookeaze_image_library_v1");
  sessionStorage.removeItem("cookeaze_food_images_catalog_v1");
  sessionStorage.removeItem("cookeaze_food_images_catalog_v2");
} catch (e) {
  // ignore storage errors
}

const IGNORED_NAME_KEYS = new Set([
  "id",
  "pk",
  "uuid",
  "url",
  "image",
  "image_url",
  "file",
  "file_url",
  "secure_url",
  "photo",
  "photo_url",
  "thumbnail",
  "thumb",
  "thumbnail_url",
  "created_at",
  "createdAt",
  "uploaded_at",
  "uploadedAt",
  "updated_at",
  "updatedAt",
  "date_added",
  "status",
  "source",
  "public_id",
  "asset_id",
  "format",
  "resource_type",
  "type",
  "folder",
  "asset_folder",
]);

export function cleanStringList(input) {
  if (!input) return [];
  let rawArr = [];
  if (typeof input === "string") {
    const trimmedInput = input.trim();
    if (trimmedInput.startsWith("[") && trimmedInput.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmedInput);
        if (Array.isArray(parsed)) rawArr = parsed;
      } catch (e) {
        rawArr = trimmedInput.split(",");
      }
    } else {
      rawArr = trimmedInput.split(",");
    }
  } else if (Array.isArray(input)) {
    rawArr = input;
  }

  const seen = new Set();
  const out = [];
  for (let i = 0; i < rawArr.length; i += 1) {
    const entry = rawArr[i];
    const str =
      typeof entry === "string"
        ? entry
        : entry?.name ||
          entry?.tag ||
          entry?.tag_name ||
          entry?.synonym ||
          entry?.label ||
          entry?.title ||
          entry?.slug ||
          entry?.value ||
          "";
    const trimmed = String(str || "").trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(trimmed);
    }
  }
  return out;
}

export function normalizeFoodImage(raw) {
  if (!raw || typeof raw !== "object") return null;
  const rawId = raw.id ?? raw.pk ?? raw.uuid;
  if (rawId === undefined || rawId === null) return null;
  const id = String(rawId).trim();

  let url = String(
    raw.image_url ||
      raw.url ||
      raw.image ||
      raw.file ||
      raw.file_url ||
      raw.secure_url ||
      raw.photo ||
      raw.photo_url ||
      raw.thumbnail ||
      raw.thumb ||
      ""
  ).trim();

  if (url && url.startsWith("/")) {
    url = `https://api.cookeaze.app${url}`;
  }

  let thumb = String(
    raw.thumbnail || raw.thumb || raw.thumbnail_url || url
  ).trim();
  if (thumb && thumb.startsWith("/")) {
    thumb = `https://api.cookeaze.app${thumb}`;
  }

  // Extract tags from explicit or dynamic array/tag fields
  let rawTagsSource =
    raw.tags ??
    raw.tag_list ??
    raw.tag_names ??
    raw.food_tags ??
    raw.image_tags ??
    raw.categories ??
    raw.keywords ??
    raw.labels ??
    null;

  if (!rawTagsSource) {
    for (const [k, v] of Object.entries(raw)) {
      const lowerK = k.toLowerCase();
      if (
        (lowerK.includes("tag") ||
          lowerK.includes("cat") ||
          lowerK.includes("keyword") ||
          lowerK.includes("label")) &&
        (Array.isArray(v) || typeof v === "string")
      ) {
        rawTagsSource = v;
        break;
      }
    }
  }
  // If still no tags found, check any array field on `raw` that isn't a synonym field
  if (!rawTagsSource) {
    for (const [k, v] of Object.entries(raw)) {
      const lowerK = k.toLowerCase();
      if (
        Array.isArray(v) &&
        v.length > 0 &&
        !lowerK.includes("syn") &&
        !lowerK.includes("alias")
      ) {
        rawTagsSource = v;
        break;
      }
    }
  }
  const tags = cleanStringList(rawTagsSource);

  // Extract synonyms from explicit or dynamic synonym/alias fields
  let rawSynSource =
    raw.synonyms ??
    raw.synonym_list ??
    raw.synonym_names ??
    raw.aliases ??
    raw.alt_names ??
    raw.alternative_names ??
    raw.search_terms ??
    raw.other_names ??
    null;

  if (!rawSynSource) {
    for (const [k, v] of Object.entries(raw)) {
      const lowerK = k.toLowerCase();
      if (
        (lowerK.includes("syn") ||
          lowerK.includes("alias") ||
          lowerK.includes("alt")) &&
        (Array.isArray(v) || typeof v === "string")
      ) {
        rawSynSource = v;
        break;
      }
    }
  }
  const synonyms = cleanStringList(rawSynSource);

  // Extract explicit name/title from all common field names
  let explicitName =
    raw.name ||
    raw.food_name ||
    raw.image_name ||
    raw.dish_name ||
    raw.meal_name ||
    raw.recipe_name ||
    raw.recipe_title ||
    raw.item_name ||
    raw.title ||
    raw.label ||
    raw.caption ||
    raw.alt_text ||
    raw.alt ||
    raw.description ||
    raw.query ||
    raw.search_query ||
    raw.search_term ||
    raw.prompt ||
    raw.keyword ||
    raw.category_name ||
    (typeof raw.category === "string" ? raw.category : raw.category?.name) ||
    (typeof raw.food === "string" ? raw.food : raw.food?.name) ||
    (typeof raw.recipe === "string"
      ? raw.recipe
      : raw.recipe?.name || raw.recipe?.title) ||
    raw.display_name ||
    "";

  // If still empty, scan any other descriptive string or nested object field on `raw`
  if (!explicitName || !String(explicitName).trim()) {
    for (const [k, v] of Object.entries(raw)) {
      if (IGNORED_NAME_KEYS.has(k)) continue;
      if (
        typeof v === "string" &&
        v.trim() &&
        !v.trim().startsWith("http") &&
        !v.trim().startsWith("/") &&
        !/^\d{4}-\d{2}-\d{2}/.test(v.trim())
      ) {
        explicitName = v.trim();
        break;
      }
      if (v && typeof v === "object" && !Array.isArray(v)) {
        const nestedName =
          v.name || v.title || v.food_name || v.dish_name || v.label;
        if (typeof nestedName === "string" && nestedName.trim()) {
          explicitName = nestedName.trim();
          break;
        }
      }
    }
  }

  const hasBackendName = Boolean(
    explicitName && String(explicitName).trim()
  );

  const fallbackName =
    tags.length > 0
      ? tags[0].replace(/\b\w/g, (c) => c.toUpperCase())
      : synonyms.length > 0
      ? synonyms[0].replace(/\b\w/g, (c) => c.toUpperCase())
      : `Untitled Image #${id}`;

  const name = hasBackendName
    ? String(explicitName).trim()
    : fallbackName;

  const rawDate =
    raw.uploaded_at ||
    raw.uploadedAt ||
    raw.created_at ||
    raw.createdAt ||
    raw.date_added ||
    raw.updated_at ||
    "";
  const uploadedAt = rawDate ? String(rawDate).slice(0, 10) : "—";

  return {
    id,
    url,
    thumb: thumb || url,
    name,
    hasBackendName,
    tags,
    synonyms,
    uploadedAt,
    source: raw.source || "manual",
    status: raw.status || "approved",
    rawKeys: Object.keys(raw),
    rawPayload: raw,
  };
}

export function normalizeUrlForDedupe(rawUrl) {
  if (!rawUrl) return "";
  return String(rawUrl)
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("?")[0]
    .split("#")[0]
    .replace(/\/image\/upload\/v\d+\//i, "/image/upload/")
    .replace(/\/+$/, "")
    .toLowerCase();
}

export function deduplicateGalleryItems(items) {
  const seenIds = new Set();
  const byUrlKey = new Map();
  const byNameKey = new Map();
  const uniqueItems = [];
  const duplicateIds = [];

  for (let i = 0; i < (items || []).length; i += 1) {
    const item = items[i];
    if (!item || !item.id) continue;
    const idStr = String(item.id);
    if (seenIds.has(idStr)) continue;
    seenIds.add(idStr);

    const urlKey = normalizeUrlForDedupe(item.url);
    const cleanName = String(item.name || "").trim().toLowerCase();
    const hasExplicitName =
      Boolean(item.hasBackendName) &&
      cleanName &&
      !cleanName.startsWith("untitled image #") &&
      !cleanName.startsWith("food image #");

    const existingByUrl = urlKey ? byUrlKey.get(urlKey) : null;
    const existingByName = hasExplicitName ? byNameKey.get(cleanName) : null;
    const primary = existingByUrl || existingByName;

    if (primary) {
      // Merge any tags/synonyms from the duplicate onto the primary record before discarding
      primary.tags = cleanStringList([
        ...(primary.tags || []),
        ...(item.tags || []),
      ]);
      primary.synonyms = cleanStringList([
        ...(primary.synonyms || []),
        ...(item.synonyms || []),
      ]);
      if (!primary.hasBackendName && item.hasBackendName && item.name) {
        primary.name = item.name;
        primary.hasBackendName = true;
      }
      duplicateIds.push(idStr);
    } else {
      const cloned = { ...item };
      uniqueItems.push(cloned);
      if (urlKey) byUrlKey.set(urlKey, cloned);
      if (hasExplicitName) byNameKey.set(cleanName, cloned);
    }
  }

  return { uniqueItems, duplicateIds };
}

function extractPagePayload(resData) {
  const root = resData?.data !== undefined ? resData.data : resData;
  if (Array.isArray(root)) {
    return {
      results: root,
      count: root.length,
      next: null,
    };
  }
  const results = Array.isArray(root?.results)
    ? root.results
    : Array.isArray(root?.images)
    ? root.images
    : Array.isArray(root?.items)
    ? root.items
    : [];
  const count =
    typeof root?.count === "number"
      ? root.count
      : typeof resData?.count === "number"
      ? resData.count
      : results.length;
  const next = root?.next ?? resData?.next ?? null;
  return { results, count, next };
}

function loadCompleteCatalogCache() {
  try {
    const raw = sessionStorage.getItem(CATALOG_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      parsed.complete === true &&
      Array.isArray(parsed.items) &&
      parsed.items.length > 0
    ) {
      return parsed;
    }
  } catch (e) {
    // ignore storage errors
  }
  return null;
}

function saveCompleteCatalogCache(items, totalCount) {
  try {
    sessionStorage.setItem(
      CATALOG_CACHE_KEY,
      JSON.stringify({
        complete: true,
        updatedAt: Date.now(),
        totalCount: totalCount || items.length,
        items,
      })
    );
  } catch (e) {
    // ignore storage quota errors
  }
}

function clearCatalogCache() {
  try {
    sessionStorage.removeItem(CATALOG_CACHE_KEY);
  } catch (e) {
    // ignore
  }
}

export const api = {
  images: {
    list: async (params = {}) => {
      const res = await axiosInstance.get(FOOD_IMAGES_API, { params });
      return extractPagePayload(res.data);
    },
    search: async (q) => {
      const res = await axiosInstance.get(`${FOOD_IMAGES_API}search/`, {
        params: { q, search: q },
      });
      return extractPagePayload(res.data);
    },
    upload: async (payload) => {
      const res = await axiosInstance.post(FOOD_IMAGES_API, payload);
      return res.data?.data || res.data;
    },
    update: async (id, payload) => {
      try {
        const res = await axiosInstance.patch(
          `${FOOD_IMAGES_API}${id}/`,
          payload
        );
        return res.data?.data || res.data;
      } catch (patchErr) {
        const res = await axiosInstance.put(
          `${FOOD_IMAGES_API}${id}/`,
          payload
        );
        return res.data?.data || res.data;
      }
    },
    delete: async (id) => {
      const res = await axiosInstance.delete(`${FOOD_IMAGES_API}${id}/`, {
        timeout: 15000,
      });
      return res.data;
    },
    bulkTag: async (ids, newTags, currentItemsMap) => {
      const step = 4;
      for (let i = 0; i < ids.length; i += step) {
        const chunk = ids.slice(i, i + step);
        await Promise.allSettled(
          chunk.map((id) => {
            const existing = currentItemsMap?.get(String(id));
            const mergedTags = cleanStringList([
              ...(existing?.tags || []),
              ...newTags,
            ]);
            return api.images.update(id, { tags: mergedTags });
          })
        );
      }
      return { ok: true };
    },
    bulkDelete: async (ids) => {
      const failedIds = [];
      const step = 4;
      for (let i = 0; i < ids.length; i += step) {
        const chunk = ids.slice(i, i + step);
        const results = await Promise.allSettled(
          chunk.map((id) => api.images.delete(id))
        );
        for (let j = 0; j < results.length; j += 1) {
          if (results[j].status === "rejected") {
            const status = results[j].reason?.response?.status;
            if (status !== 404) {
              failedIds.push(chunk[j]);
            }
          }
        }
      }
      return { ok: failedIds.length === 0, failedIds };
    },
  },
};

export default function ImageLibrary() {
  const initialCache = loadCompleteCatalogCache();

  const [images, setImages] = useState(() => initialCache?.items || []);
  const [serverTotalCount, setServerTotalCount] = useState(
    () => initialCache?.totalCount || initialCache?.items?.length || 0
  );
  const [loadingInitial, setLoadingInitial] = useState(
    () => !initialCache?.items?.length
  );
  const [syncingCatalog, setSyncingCatalog] = useState(false);
  const [syncProgressPct, setSyncProgressPct] = useState(() =>
    initialCache?.complete ? 100 : 0
  );
  const [apiError, setApiError] = useState(null);
  const [brokenUrls, setBrokenUrls] = useState(() => new Set());

  // Upload & Quick Replace state
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [quickReplaceTarget, setQuickReplaceTarget] = useState(null);
  const [replacingId, setReplacingId] = useState(null);

  // Filters & View Controls
  const [search, setSearch] = useState("");
  const [filterTag, setFilterTag] = useState("all");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "name" | "most_tags" | "most_synonyms"
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [pageSize, setPageSize] = useState(12);
  const [currentPage, setCurrentPage] = useState(1);
  const [removedDuplicatesCount, setRemovedDuplicatesCount] = useState(0);

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [showBulkTagDrawer, setShowBulkTagDrawer] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(null);

  // Modals
  const [detailModal, setDetailModal] = useState(null); // { mode: "view" | "edit", item }
  const [addUrlModalOpen, setAddUrlModalOpen] = useState(false);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchDrafts, setBatchDrafts] = useState([]);
  const [savingBatch, setSavingBatch] = useState(false);
  const [showPayloadInspector, setShowPayloadInspector] = useState(false);

  // Feedback & Clipboard
  const [statusBanner, setStatusBanner] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const uploadInputRef = useRef(null);
  const quickReplaceInputRef = useRef(null);

  // Refs for background sync coordination & optimistic mutations
  const syncAbortRef = useRef(null);
  const isCatalogCompleteRef = useRef(Boolean(initialCache?.complete));
  const deletedIdsRef = useRef(new Set());
  const editedItemsMapRef = useRef(new Map());
  const activeMutationsCountRef = useRef(0);

  const beginMutation = () => {
    activeMutationsCountRef.current += 1;
  };
  const endMutation = () => {
    activeMutationsCountRef.current = Math.max(
      0,
      activeMutationsCountRef.current - 1
    );
  };
  const waitUntilNoMutations = async (signal) => {
    while (activeMutationsCountRef.current > 0 && !signal?.aborted) {
      await new Promise((r) => setTimeout(r, 150));
    }
  };

  const showToast = useCallback((text, type = "success") => {
    setStatusBanner({ text, type });
  }, []);

  useEffect(() => {
    if (!statusBanner) return undefined;
    const t = setTimeout(() => setStatusBanner(null), 4000);
    return () => clearTimeout(t);
  }, [statusBanner]);

  const updateCacheIfComplete = useCallback((nextItems, nextTotal) => {
    if (isCatalogCompleteRef.current && nextItems.length > 0) {
      saveCompleteCatalogCache(nextItems, nextTotal || nextItems.length);
    }
  }, []);

  // Load full Food Images catalog from `https://api.cookeaze.app/api/food-images/`
  const loadFoodImagesCatalog = useCallback(
    async (forceRefresh = false) => {
      if (syncAbortRef.current) {
        syncAbortRef.current.abort();
      }
      const controller = new AbortController();
      syncAbortRef.current = controller;

      if (!forceRefresh) {
        const cached = loadCompleteCatalogCache();
        if (cached && cached.items.length > 0) {
          isCatalogCompleteRef.current = true;
          setImages(cached.items);
          setServerTotalCount(cached.totalCount || cached.items.length);
          setLoadingInitial(false);
          setSyncingCatalog(false);
          setSyncProgressPct(100);
          return;
        }
      } else {
        clearCatalogCache();
        isCatalogCompleteRef.current = false;
      }

      setApiError(null);
      if (images.length === 0) {
        setLoadingInitial(true);
      }
      setSyncingCatalog(true);
      setSyncProgressPct(5);

      try {
        const firstRes = await axiosInstance.get(`${FOOD_IMAGES_API}?page=1`, {
          signal: controller.signal,
        });

        const { results: firstResults, count: totalCount } = extractPagePayload(
          firstRes.data
        );

        const mergedMap = new Map();
        for (let i = 0; i < firstResults.length; i += 1) {
          const norm = normalizeFoodImage(firstResults[i]);
          if (norm && !deletedIdsRef.current.has(norm.id)) {
            mergedMap.set(
              norm.id,
              editedItemsMapRef.current.get(norm.id) || norm
            );
          }
        }

        const rawFirstBatch = Array.from(mergedMap.values());
        const {
          uniqueItems: firstBatchList,
          duplicateIds: firstDupIds,
        } = deduplicateGalleryItems(rawFirstBatch);

        const trueServerTotal = Math.max(
          Number(totalCount) || 0,
          rawFirstBatch.length
        );

        setImages(firstBatchList);
        setRemovedDuplicatesCount(firstDupIds.length);
        setServerTotalCount(
          Math.max(0, trueServerTotal - firstDupIds.length)
        );
        setLoadingInitial(false);

        const pageSizeFromServer = firstResults.length || 10;
        const totalServerPages =
          trueServerTotal > rawFirstBatch.length
            ? Math.ceil(trueServerTotal / pageSizeFromServer)
            : 1;

        if (totalServerPages <= 1) {
          isCatalogCompleteRef.current = true;
          setSyncProgressPct(100);
          setSyncingCatalog(false);
          saveCompleteCatalogCache(firstBatchList, firstBatchList.length);
          if (firstDupIds.length > 0) {
            firstDupIds.forEach((id) => deletedIdsRef.current.add(String(id)));
            api.images.bulkDelete(firstDupIds).catch(() => {});
          }
          return;
        }

        // Progressively fetch remaining pages in batches of 6 with retry passes
        let pendingPages = [];
        for (let p = 2; p <= totalServerPages; p += 1) {
          pendingPages.push(p);
        }

        let completedPagesCount = 1;
        const maxRetryPasses = 3;
        const batchStepSize = 6;

        for (
          let pass = 0;
          pass < maxRetryPasses && pendingPages.length > 0;
          pass += 1
        ) {
          if (controller.signal.aborted) break;
          const failedPagesInPass = [];

          for (let i = 0; i < pendingPages.length; i += batchStepSize) {
            if (controller.signal.aborted) break;
            await waitUntilNoMutations(controller.signal);
            if (controller.signal.aborted) break;

            const batchPages = pendingPages.slice(i, i + batchStepSize);
            const batchResults = await Promise.allSettled(
              batchPages.map((pageNum) =>
                axiosInstance.get(`${FOOD_IMAGES_API}?page=${pageNum}`, {
                  signal: controller.signal,
                })
              )
            );

            if (controller.signal.aborted) break;

            for (let idx = 0; idx < batchResults.length; idx += 1) {
              const resItem = batchResults[idx];
              const pageNum = batchPages[idx];
              if (resItem.status === "fulfilled") {
                completedPagesCount += 1;
                const { results: pageResults } = extractPagePayload(
                  resItem.value.data
                );
                for (let j = 0; j < pageResults.length; j += 1) {
                  const norm = normalizeFoodImage(pageResults[j]);
                  if (norm && !deletedIdsRef.current.has(norm.id)) {
                    mergedMap.set(
                      norm.id,
                      editedItemsMapRef.current.get(norm.id) || norm
                    );
                  }
                }
              } else {
                const status = resItem.reason?.response?.status;
                if (status === 404) {
                  completedPagesCount += 1;
                } else {
                  failedPagesInPass.push(pageNum);
                }
              }
            }

            setSyncProgressPct(
              Math.min(
                99,
                Math.round((completedPagesCount / totalServerPages) * 100)
              )
            );

            const rawSnapshot = Array.from(mergedMap.values()).filter(
              (item) => !deletedIdsRef.current.has(item.id)
            );
            const {
              uniqueItems: dedupedSnapshot,
              duplicateIds: snapDupIds,
            } = deduplicateGalleryItems(rawSnapshot);
            setImages(dedupedSnapshot);
            setRemovedDuplicatesCount(snapDupIds.length);
          }

          pendingPages = failedPagesInPass;
          if (pendingPages.length > 0 && !controller.signal.aborted) {
            await new Promise((r) => setTimeout(r, 350 * (pass + 1)));
          }
        }

        if (!controller.signal.aborted) {
          const rawFinalItems = Array.from(mergedMap.values()).filter(
            (item) => !deletedIdsRef.current.has(item.id)
          );
          const {
            uniqueItems: finalItems,
            duplicateIds: finalDupIds,
          } = deduplicateGalleryItems(rawFinalItems);

          setImages(finalItems);
          setRemovedDuplicatesCount(finalDupIds.length);

          if (pendingPages.length === 0) {
            isCatalogCompleteRef.current = true;
            setServerTotalCount(finalItems.length);
            saveCompleteCatalogCache(finalItems, finalItems.length);

            // Automatically delete any duplicate rows from the backend in the background
            if (finalDupIds.length > 0) {
              finalDupIds.forEach((id) =>
                deletedIdsRef.current.add(String(id))
              );
              api.images.bulkDelete(finalDupIds).catch(() => {});
            }
          }
          setSyncProgressPct(100);
          setSyncingCatalog(false);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error("Failed to load Food Images API:", err);
        setLoadingInitial(false);
        setSyncingCatalog(false);
        const isOffline =
          !err?.response &&
          (err?.code === "ERR_NETWORK" ||
            err?.message === "Network Error" ||
            (typeof navigator !== "undefined" && navigator.onLine === false));
        setApiError(
          isOffline
            ? "Network connection interrupted. The Image Library will automatically reload when you reconnect."
            : err?.response?.data?.message ||
                "Unable to load images from the server right now. Please click Refresh to retry."
        );
      }
    },
    [images.length]
  );

  useEffect(() => {
    loadFoodImagesCatalog(false);
    return () => {
      if (syncAbortRef.current) {
        syncAbortRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Automatically re-fetch on network reconnect or token refresh
  useEffect(() => {
    const handleOnline = () => {
      if (!isCatalogCompleteRef.current || apiError) {
        loadFoodImagesCatalog(true);
      }
    };
    const handleTokenUpdated = () => {
      if (!isCatalogCompleteRef.current || apiError) {
        loadFoodImagesCatalog(false);
      }
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("cookeaze:token-updated", handleTokenUpdated);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("cookeaze:token-updated", handleTokenUpdated);
    };
  }, [apiError, loadFoodImagesCatalog]);

  // Also query `/api/food-images/search/?q=...` when searching while background sync is still in progress
  useEffect(() => {
    const q = search.trim();
    if (!q || isCatalogCompleteRef.current) return undefined;

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const { results } = await api.images.search(q);
        if (cancelled || !Array.isArray(results) || !results.length) return;
        setImages((prev) => {
          const byId = new Map();
          prev.forEach((item) => byId.set(item.id, item));
          results.forEach((raw) => {
            const norm = normalizeFoodImage(raw);
            if (norm && !deletedIdsRef.current.has(norm.id) && !byId.has(norm.id)) {
              byId.set(norm.id, norm);
            }
          });
          return deduplicateGalleryItems(Array.from(byId.values())).uniqueItems;
        });
      } catch (e) {
        // ignore search endpoint error; client-side filter handles loaded items
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search]);

  // Multi-layer Deduplication Analysis (ID + normalized URL + explicit Name)
  const galleryAnalysis = useMemo(() => {
    const { uniqueItems, duplicateIds } = deduplicateGalleryItems(images);
    let namedInBackendCount = 0;
    let taggedInBackendCount = 0;
    const keySet = new Set();

    for (let i = 0; i < uniqueItems.length; i += 1) {
      const item = uniqueItems[i];
      if (item.hasBackendName) namedInBackendCount += 1;
      if ((item.tags?.length || 0) > 0) taggedInBackendCount += 1;
      if (Array.isArray(item.rawKeys)) {
        item.rawKeys.forEach((k) => keySet.add(k));
      }
    }

    const totalSynonyms = uniqueItems.reduce(
      (acc, i) => acc + (i.synonyms?.length || 0),
      0
    );

    return {
      allItems: uniqueItems,
      uniqueItems,
      duplicateCount: removedDuplicatesCount + duplicateIds.length,
      totalSynonyms,
      namedInBackendCount,
      taggedInBackendCount,
      backendKeys: Array.from(keySet),
      sampleRawPayload: uniqueItems[0]?.rawPayload || null,
    };
  }, [images, removedDuplicatesCount]);

  const activePool = galleryAnalysis.uniqueItems;

  // True total count display (shows serverTotalCount while background pages are syncing)
  const displayTotalGalleryCount = isCatalogCompleteRef.current
    ? activePool.length
    : Math.max(serverTotalCount, activePool.length);

  // Compute Tag stats with counts across the active pool
  const tagStats = useMemo(() => {
    const counts = new Map();
    for (let i = 0; i < activePool.length; i += 1) {
      const tags = activePool[i].tags || [];
      const seenInItem = new Set();
      for (let j = 0; j < tags.length; j += 1) {
        const raw = String(tags[j] || "").trim();
        if (!raw) continue;
        const key = raw.toLowerCase();
        if (seenInItem.has(key)) continue;
        seenInItem.add(key);
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { label: raw, key, count: 1 });
        }
      }
    }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [activePool]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const activeTagKey = filterTag === "all" ? "" : filterTag.toLowerCase();

    const list = activePool.filter((item) => {
      if (activeTagKey) {
        const hasTag = (item.tags || []).some(
          (t) => String(t).trim().toLowerCase() === activeTagKey
        );
        if (!hasTag) return false;
      }

      if (q) {
        const matchName = String(item.name || "")
          .toLowerCase()
          .includes(q);
        const matchTag = (item.tags || []).some((t) =>
          String(t).toLowerCase().includes(q)
        );
        const matchSyn = (item.synonyms || []).some((s) =>
          String(s).toLowerCase().includes(q)
        );
        if (!matchName && !matchTag && !matchSyn) {
          return false;
        }
      }
      return true;
    });

    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    } else if (sortBy === "most_tags") {
      sorted.sort(
        (a, b) => (b.tags?.length || 0) - (a.tags?.length || 0)
      );
    } else if (sortBy === "most_synonyms") {
      sorted.sort(
        (a, b) => (b.synonyms?.length || 0) - (a.synonyms?.length || 0)
      );
    } else {
      sorted.sort((a, b) => {
        const dateCmp = String(b.uploadedAt || "").localeCompare(
          String(a.uploadedAt || "")
        );
        if (dateCmp !== 0) return dateCmp;
        return (Number(b.id) || 0) - (Number(a.id) || 0);
      });
    }

    return sorted;
  }, [activePool, search, filterTag, sortBy]);

  // Pagination calculations
  const totalFiltered = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterTag, pageSize]);

  // Copy URL to clipboard
  const handleCopyUrl = useCallback(
    async (item, e) => {
      if (e) e.stopPropagation();
      if (!item?.url) {
        showToast("This image has no URL to copy.", "warning");
        return;
      }
      try {
        await navigator.clipboard.writeText(item.url);
        setCopiedId(item.id);
        showToast(`Copied URL for "${item.name}"`);
        setTimeout(() => setCopiedId(null), 2000);
      } catch (err) {
        showToast("Failed to copy image URL.", "danger");
      }
    },
    [showToast]
  );

  // Multi-file upload handler -> uploads to Cloudinary & POSTs to `/api/food-images/`
  const processUploadedFiles = useCallback(
    async (fileList) => {
      const files = Array.from(fileList || []).filter((f) =>
        f.type.startsWith("image/")
      );
      if (!files.length) return;

      beginMutation();
      setUploadingFiles(true);
      const createdItems = [];

      try {
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          let finalUrl = "";
          try {
            if (CloudinaryService.cloudName && CloudinaryService.apiKey) {
              const cloudUrl = await CloudinaryService.uploadMedia(file, {
                folder: "cookeaze_image_library",
              });
              if (cloudUrl) finalUrl = cloudUrl;
            }
          } catch (e) {
            // fallback to local preview if Cloudinary fails
          }
          if (!finalUrl) {
            finalUrl = URL.createObjectURL(file);
          }

          const cleanTitle = file.name
            .replace(/\.[^.]+$/, "")
            .replace(/[-_]+/g, " ")
            .trim();

          const autoTags = cleanTitle
            .toLowerCase()
            .split(/\s+/)
            .filter((w) => w.length > 2)
            .slice(0, 3);

          const payload = {
            name: cleanTitle || "Uploaded Food Image",
            food_name: cleanTitle || "Uploaded Food Image",
            url: finalUrl,
            image_url: finalUrl,
            thumb: finalUrl,
            tags: cleanStringList(autoTags),
            synonyms: [],
          };

          let savedItem = null;
          try {
            const resData = await api.images.upload(payload);
            savedItem = normalizeFoodImage(resData);
          } catch (postErr) {
            // fallback optimistic item
          }

          if (!savedItem) {
            savedItem = {
              id: String(Date.now() + i),
              url: finalUrl,
              thumb: finalUrl,
              name: cleanTitle || "Uploaded Food Image",
              tags: cleanStringList(autoTags),
              synonyms: [],
              uploadedAt: new Date().toISOString().slice(0, 10),
            };
          }

          editedItemsMapRef.current.set(savedItem.id, savedItem);
          createdItems.push(savedItem);
        }

        setImages((prev) => {
          const next = [...createdItems, ...prev];
          updateCacheIfComplete(next, serverTotalCount + createdItems.length);
          return next;
        });
        setServerTotalCount((prev) => prev + createdItems.length);

        if (createdItems.length === 1) {
          showToast("Image uploaded — add tags & synonyms to get started.");
          setDetailModal({ mode: "edit", item: createdItems[0] });
        } else {
          showToast(`Uploaded ${createdItems.length} images to Image Library.`);
        }
      } finally {
        setUploadingFiles(false);
        endMutation();
      }
    },
    [serverTotalCount, showToast, updateCacheIfComplete]
  );

  const handleFileInputChange = (e) => {
    if (e.target.files?.length) {
      processUploadedFiles(e.target.files);
      e.target.value = "";
    }
  };

  // Quick 1-Click Photo Replace directly on any Gallery Card -> PATCHes `/api/food-images/:id/`
  const triggerQuickReplace = (item, e) => {
    if (e) e.stopPropagation();
    setQuickReplaceTarget(item);
    if (quickReplaceInputRef.current) {
      quickReplaceInputRef.current.value = "";
      quickReplaceInputRef.current.click();
    }
  };

  const handleQuickReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    const target = quickReplaceTarget;
    if (!file || !target) return;

    beginMutation();
    setReplacingId(target.id);
    try {
      let newUrl = "";
      if (CloudinaryService.cloudName && CloudinaryService.apiKey) {
        const uploaded = await CloudinaryService.uploadMedia(file, {
          folder: "cookeaze_image_library",
        });
        if (uploaded) newUrl = uploaded;
      }
      if (!newUrl) {
        newUrl = URL.createObjectURL(file);
      }

      const updatedObj = { ...target, url: newUrl, thumb: newUrl };
      editedItemsMapRef.current.set(target.id, updatedObj);

      setImages((prev) => {
        const next = prev.map((img) =>
          img.id === target.id ? updatedObj : img
        );
        updateCacheIfComplete(next);
        return next;
      });

      setBrokenUrls((prev) => {
        const next = new Set(prev);
        if (target.url) next.delete(target.url);
        return next;
      });

      await api.images.update(target.id, {
        name: target.name,
        url: newUrl,
        image_url: newUrl,
        thumb: newUrl,
        tags: target.tags,
        synonyms: target.synonyms,
      });

      showToast(`Replaced image for "${target.name}"`);
    } catch (err) {
      showToast("Replaced image locally.", "warning");
    } finally {
      setReplacingId(null);
      setQuickReplaceTarget(null);
      endMutation();
    }
  };

  // 1-Click Inline Tag Removal on any Card -> PATCHes `/api/food-images/:id/`
  const handleRemoveSingleTag = useCallback(
    async (item, tagToRemove, e) => {
      if (e) e.stopPropagation();
      const nextTags = (item.tags || []).filter(
        (t) => String(t).toLowerCase() !== String(tagToRemove).toLowerCase()
      );
      const updated = { ...item, tags: nextTags };
      editedItemsMapRef.current.set(item.id, updated);

      setImages((prev) => {
        const next = prev.map((img) => (img.id === item.id ? updated : img));
        updateCacheIfComplete(next);
        return next;
      });
      showToast(`Removed tag "${tagToRemove}" from "${item.name}"`);

      beginMutation();
      try {
        await api.images.update(item.id, {
          name: item.name,
          tags: nextTags,
          synonyms: item.synonyms,
        });
      } catch (err) {
        // keep optimistic update
      } finally {
        endMutation();
      }
    },
    [showToast, updateCacheIfComplete]
  );

  // Selection helpers
  const toggleSelectItem = (id, e) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected =
    paginatedItems.length > 0 &&
    paginatedItems.every((i) => selectedIds.has(i.id));

  const toggleSelectPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) {
        paginatedItems.forEach((i) => next.delete(i.id));
      } else {
        paginatedItems.forEach((i) => next.add(i.id));
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredItems.map((i) => i.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setShowBulkTagDrawer(false);
  };

  // Bulk Add Tags -> optimistic 0ms update + background PATCH `/api/food-images/:id/`
  const handleApplyBulkTags = async () => {
    const newTags = cleanStringList(bulkTagInput.split(","));
    if (!newTags.length || selectedIds.size === 0) return;

    const idsArray = Array.from(selectedIds);
    const currentItemsMap = new Map();

    setImages((prev) => {
      const next = prev.map((img) => {
        if (!selectedIds.has(img.id)) return img;
        currentItemsMap.set(String(img.id), img);
        const updated = {
          ...img,
          tags: cleanStringList([...(img.tags || []), ...newTags]),
        };
        editedItemsMapRef.current.set(img.id, updated);
        return updated;
      });
      updateCacheIfComplete(next);
      return next;
    });

    const count = idsArray.length;
    setBulkTagInput("");
    setShowBulkTagDrawer(false);
    showToast(`Added ${newTags.length} tag(s) to ${count} selected image(s).`);

    beginMutation();
    try {
      await api.images.bulkTag(idsArray, newTags, currentItemsMap);
    } finally {
      endMutation();
    }
  };

  // Instant Optimistic Delete (Single or Bulk -> 0ms UI update + background DELETE `/api/food-images/:id/`)
  const executeOptimisticDelete = async (idsToRemove) => {
    const idSet = new Set(idsToRemove.map((id) => String(id)));
    const count = idSet.size;

    // Close modal immediately (0ms)
    setConfirmDeleteModal(null);
    setDetailModal(null);

    idSet.forEach((id) => deletedIdsRef.current.add(id));

    setImages((prev) => {
      const next = prev.filter((i) => !idSet.has(String(i.id)));
      updateCacheIfComplete(next, Math.max(0, serverTotalCount - count));
      return next;
    });
    setServerTotalCount((prev) => Math.max(0, prev - count));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      idSet.forEach((id) => next.delete(id));
      return next;
    });

    showToast(`Deleted ${count} image${count === 1 ? "" : "s"} from library.`);

    beginMutation();
    try {
      if (count === 1) {
        await api.images.delete(idsToRemove[0]);
      } else {
        await api.images.bulkDelete(Array.from(idSet));
      }
    } catch (err) {
      // ignore 404 or background error
    } finally {
      endMutation();
    }
  };

  // Save single item edit -> optimistic 0ms update + PATCH `/api/food-images/:id/`
  const handleSaveItemEdit = async (updatedItem) => {
    const cleaned = {
      ...updatedItem,
      name: String(updatedItem.name || "Untitled Image").trim(),
      url: String(updatedItem.url || "").trim(),
      thumb: String(updatedItem.url || updatedItem.thumb || "").trim(),
      tags: cleanStringList(updatedItem.tags),
      synonyms: cleanStringList(updatedItem.synonyms),
    };

    setDetailModal(null);
    editedItemsMapRef.current.set(cleaned.id, cleaned);

    setImages((prev) => {
      const next = prev.map((i) => (i.id === cleaned.id ? cleaned : i));
      updateCacheIfComplete(next);
      return next;
    });
    showToast(`Saved changes to "${cleaned.name}".`);

    beginMutation();
    try {
      await api.images.update(cleaned.id, {
        name: cleaned.name,
        food_name: cleaned.name,
        url: cleaned.url,
        image_url: cleaned.url,
        thumb: cleaned.thumb,
        tags: cleaned.tags,
        synonyms: cleaned.synonyms,
      });
    } catch (err) {
      // keep optimistic update
    } finally {
      endMutation();
    }
  };

  // Batch Editor Modal -> edits multiple images side-by-side & saves via PATCH `/api/food-images/:id/`
  const openBatchEditor = (itemsToEdit) => {
    const drafts = itemsToEdit.map((item) => ({
      id: item.id,
      name: item.name || "",
      url: item.url || "",
      tagsInput: (item.tags || []).join(", "),
      synonymsInput: (item.synonyms || []).join(", "),
      dirty: false,
      original: item,
    }));
    setBatchDrafts(drafts);
    setBatchModalOpen(true);
  };

  const updateBatchDraft = (id, field, value) => {
    setBatchDrafts((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, [field]: value, dirty: true } : d
      )
    );
  };

  const saveAllBatchDrafts = async () => {
    const dirtyDrafts = batchDrafts.filter((d) => d.dirty);
    if (!dirtyDrafts.length) {
      setBatchModalOpen(false);
      return;
    }

    setSavingBatch(true);
    const updatesMap = new Map();
    for (let i = 0; i < dirtyDrafts.length; i += 1) {
      const d = dirtyDrafts[i];
      const updatedObj = {
        ...d.original,
        name: String(d.name || "Untitled").trim(),
        url: String(d.url || "").trim(),
        thumb: String(d.url || "").trim(),
        tags: cleanStringList(d.tagsInput.split(",")),
        synonyms: cleanStringList(d.synonymsInput.split(",")),
      };
      updatesMap.set(d.id, updatedObj);
      editedItemsMapRef.current.set(d.id, updatedObj);
    }

    setImages((prev) => {
      const next = prev.map((item) => updatesMap.get(item.id) || item);
      updateCacheIfComplete(next);
      return next;
    });

    setSavingBatch(false);
    setBatchModalOpen(false);
    showToast(`Saved batch updates for ${dirtyDrafts.length} image(s).`);

    beginMutation();
    try {
      await Promise.allSettled(
        Array.from(updatesMap.entries()).map(([id, obj]) =>
          api.images.update(id, {
            name: obj.name,
            food_name: obj.name,
            url: obj.url,
            image_url: obj.url,
            tags: obj.tags,
            synonyms: obj.synonyms,
          })
        )
      );
    } finally {
      endMutation();
    }
  };

  const hasActiveFilters = Boolean(search.trim() || filterTag !== "all");

  const resetAllFilters = () => {
    setSearch("");
    setFilterTag("all");
    setSortBy("newest");
    setCurrentPage(1);
  };

  const paginationRange = () => {
    const delta = 2;
    const range = [];
    for (
      let i = Math.max(1, safePage - delta);
      i <= Math.min(totalPages, safePage + delta);
      i += 1
    ) {
      range.push(i);
    }
    if (!range.includes(1)) range.unshift(1);
    if (!range.includes(totalPages)) range.push(totalPages);
    const out = [];
    for (let i = 0; i < range.length; i += 1) {
      const cur = range[i];
      const prev = out[out.length - 1];
      if (typeof prev === "number" && cur - prev > 1) out.push("...");
      out.push(cur);
    }
    return out;
  };

  return (
    <div className="imglib-page">
      {/* Hidden file inputs */}
      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      <input
        ref={quickReplaceInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleQuickReplaceFile}
      />

      {/* Page Header */}
      <header className="imglib-header">
        <div>
          <h1 className="imglib-title">Image Library</h1>
          <p className="imglib-subtitle">
            Browse, search, tag, and manage all{" "}
            {displayTotalGalleryCount > 0
              ? `${displayTotalGalleryCount.toLocaleString()} `
              : ""}
            food images from the Cookeaze Image Library.
          </p>
        </div>

        <div className="imglib-header-actions">
          {syncingCatalog && (
            <span className="imglib-sync-pill">
              <RefreshCw size={13} className="imglib-spin" />
              Syncing {syncProgressPct}% ({images.length.toLocaleString()} /{" "}
              {displayTotalGalleryCount.toLocaleString()})
            </span>
          )}

          <button
            type="button"
            className="imglib-btn"
            onClick={() => setShowPayloadInspector((v) => !v)}
            title="Inspect exact JSON fields coming from /api/food-images/"
          >
            <Layers size={14} />
            {showPayloadInspector ? "Hide API Payload" : "Check Backend Data"}
          </button>

          <button
            type="button"
            className="imglib-btn"
            onClick={() => loadFoodImagesCatalog(true)}
            disabled={syncingCatalog && images.length === 0}
            title="Refresh Image Library from server"
          >
            <RefreshCw
              size={14}
              className={syncingCatalog ? "imglib-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="imglib-btn"
            onClick={() => openBatchEditor(paginatedItems)}
            disabled={paginatedItems.length === 0}
          >
            <Edit3 size={14} />
            Batch Edit Page ({paginatedItems.length})
          </button>

          <button
            type="button"
            className="imglib-btn"
            onClick={() => setAddUrlModalOpen(true)}
          >
            <Link2 size={14} />
            Add by URL
          </button>

          <button
            type="button"
            className="imglib-btn imglib-btn--primary"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploadingFiles}
          >
            <Upload size={14} />
            {uploadingFiles ? "Uploading..." : "Upload Image"}
          </button>
        </div>
      </header>

      {/* Drag & Drop Quick Upload Bar */}
      <div
        className={`imglib-dropzone${
          dragActive ? " imglib-dropzone--active" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files?.length) {
            processUploadedFiles(e.dataTransfer.files);
          }
        }}
      >
        <div className="imglib-dropzone-left">
          <div className="imglib-dropzone-icon">
            <Upload size={18} />
          </div>
          <div>
            <p className="imglib-dropzone-title">
              Drag &amp; drop food images here, or click Upload Image
            </p>
            <p className="imglib-dropzone-sub">
              Uploads directly to `/api/food-images/` via Cloudinary CDN with
              automatic tag extraction and instant URL copy.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="imglib-btn imglib-btn--sm"
            onClick={() => uploadInputRef.current?.click()}
          >
            Browse Files
          </button>
        </div>
      </div>

      {/* Backend API Payload Inspector */}
      {showPayloadInspector && galleryAnalysis.sampleRawPayload && (
        <div
          style={{
            background: "#0f172a",
            color: "#e2e8f0",
            borderRadius: 12,
            padding: "14px 16px",
            marginBottom: 16,
            border: "1px solid #1e293b",
            fontSize: 12.5,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            <div>
              <strong style={{ color: "#38bdf8" }}>
                Backend Endpoint: GET {FOOD_IMAGES_API}
              </strong>{" "}
              <span style={{ color: "#94a3b8", marginLeft: 8 }}>
                Fields returned by backend:{" "}
                <code style={{ color: "#f8fafc" }}>
                  [{galleryAnalysis.backendKeys.join(", ")}]
                </code>
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: "#cbd5e1" }}>
                Named in DB:{" "}
                <strong>
                  {galleryAnalysis.namedInBackendCount.toLocaleString()}
                </strong>{" "}
                / {galleryAnalysis.allItems.length.toLocaleString()}
              </span>
              <span style={{ color: "#cbd5e1" }}>
                Tagged in DB:{" "}
                <strong>
                  {galleryAnalysis.taggedInBackendCount.toLocaleString()}
                </strong>{" "}
                / {galleryAnalysis.allItems.length.toLocaleString()}
              </span>
              <button
                type="button"
                className="imglib-btn imglib-btn--sm"
                onClick={() => setShowPayloadInspector(false)}
              >
                Close
              </button>
            </div>
          </div>
          <pre
            style={{
              margin: 0,
              padding: "10px 12px",
              background: "#020617",
              borderRadius: 8,
              color: "#a7f3d0",
              fontSize: 11.5,
              overflowX: "auto",
              maxHeight: 200,
            }}
          >
            {JSON.stringify(galleryAnalysis.sampleRawPayload, null, 2)}
          </pre>
        </div>
      )}

      {/* API Error Banner */}
      {apiError && (
        <div className="imglib-alert imglib-alert--danger">
          <span>{apiError}</span>
          <button
            type="button"
            className="imglib-btn imglib-btn--sm"
            onClick={() => loadFoodImagesCatalog(true)}
          >
            Retry
          </button>
        </div>
      )}

      {/* Status Alert Banner */}
      {statusBanner && (
        <div
          className={`imglib-alert${
            statusBanner.type === "danger"
              ? " imglib-alert--danger"
              : statusBanner.type === "warning"
              ? " imglib-alert--warning"
              : ""
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            className="imglib-alert-close"
            onClick={() => setStatusBanner(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* 4 KPI Cards */}
      <div className="imglib-kpi-grid">
        <div className="imglib-kpi-card">
          <div>
            <div className="imglib-kpi-label">
              {hasActiveFilters ? "Matching Images" : "Total Gallery Images"}
            </div>
            <div className="imglib-kpi-value">
              {hasActiveFilters
                ? totalFiltered.toLocaleString()
                : displayTotalGalleryCount.toLocaleString()}
            </div>
            <div className="imglib-kpi-sub">
              {hasActiveFilters
                ? `of ${displayTotalGalleryCount.toLocaleString()} total gallery images`
                : syncingCatalog
                ? `Loaded ${images.length.toLocaleString()} of ${displayTotalGalleryCount.toLocaleString()}...`
                : "Synced from /api/food-images/"}
            </div>
          </div>
          <div className="imglib-kpi-icon">
            <ImageIcon size={18} />
          </div>
        </div>

        <div className="imglib-kpi-card">
          <div>
            <div className="imglib-kpi-label">Active Tags</div>
            <div className="imglib-kpi-value">
              {tagStats.length.toLocaleString()}
            </div>
            <div className="imglib-kpi-sub">
              Click any tag pill below to filter
            </div>
          </div>
          <div className="imglib-kpi-icon">
            <Tag size={18} />
          </div>
        </div>

        <div className="imglib-kpi-card">
          <div>
            <div className="imglib-kpi-label">Search Synonyms</div>
            <div className="imglib-kpi-value">
              {galleryAnalysis.totalSynonyms.toLocaleString()}
            </div>
            <div className="imglib-kpi-sub">
              Mapped across {images.length.toLocaleString()} loaded images
            </div>
          </div>
          <div className="imglib-kpi-icon">
            <Sparkles size={18} />
          </div>
        </div>

        <div className="imglib-kpi-card">
          <div>
            <div className="imglib-kpi-label">Duplicate Cleanup</div>
            <div className="imglib-kpi-value">
              {galleryAnalysis.duplicateCount > 0
                ? `${galleryAnalysis.duplicateCount} Removed`
                : "100% Unique"}
            </div>
            <div className="imglib-kpi-sub">
              {galleryAnalysis.duplicateCount > 0
                ? "Duplicates stripped & purged from server"
                : "No duplicate images in library"}
            </div>
          </div>
          <div className="imglib-kpi-icon">
            <Layers size={18} />
          </div>
        </div>
      </div>

      {/* Filter & Search Control Panel */}
      <section className="imglib-panel">
        <div className="imglib-toolbar">
          <div className="imglib-search">
            <Search size={15} className="imglib-search-icon" />
            <input
              type="text"
              className="imglib-search-input"
              placeholder="Search by image name, tag, or synonym..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="imglib-search-clear"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <select
            className="imglib-select"
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            aria-label="Filter by tag"
          >
            <option value="all">
              All Tags ({displayTotalGalleryCount.toLocaleString()})
            </option>
            {tagStats.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label} ({t.count})
              </option>
            ))}
          </select>

          <select
            className="imglib-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort images"
          >
            <option value="newest">Sort: Newest</option>
            <option value="name">Sort: Name (A–Z)</option>
            <option value="most_tags">Sort: Most Tags</option>
            <option value="most_synonyms">Sort: Most Synonyms</option>
          </select>

          <select
            className="imglib-select"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Items per page"
          >
            <option value={12}>12 / page</option>
            <option value={24}>24 / page</option>
            <option value={48}>48 / page</option>
          </select>

          <div className="imglib-view-toggle">
            <button
              type="button"
              className={`imglib-view-btn${
                viewMode === "grid" ? " imglib-view-btn--active" : ""
              }`}
              onClick={() => setViewMode("grid")}
            >
              <Grid size={13} />
              Grid
            </button>
            <button
              type="button"
              className={`imglib-view-btn${
                viewMode === "table" ? " imglib-view-btn--active" : ""
              }`}
              onClick={() => setViewMode("table")}
            >
              <List size={13} />
              Table
            </button>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              className="imglib-btn imglib-btn--sm"
              onClick={resetAllFilters}
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>

        {/* Horizontal Scrollable Quick Tag Pills */}
        {tagStats.length > 0 && (
          <div className="imglib-tags-bar">
            <button
              type="button"
              className={`imglib-tag-pill${
                filterTag === "all" ? " imglib-tag-pill--active" : ""
              }`}
              onClick={() => setFilterTag("all")}
            >
              All Tags
              <span className="imglib-tag-pill-count">
                {displayTotalGalleryCount.toLocaleString()}
              </span>
            </button>
            {tagStats.slice(0, 30).map((t) => (
              <button
                key={t.key}
                type="button"
                className={`imglib-tag-pill${
                  filterTag.toLowerCase() === t.key
                    ? " imglib-tag-pill--active"
                    : ""
                }`}
                onClick={() =>
                  setFilterTag(filterTag.toLowerCase() === t.key ? "all" : t.key)
                }
              >
                {t.label}
                <span className="imglib-tag-pill-count">{t.count}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Selection & Bulk Operations Bar */}
      <div
        className={`imglib-selection-bar${
          selectedIds.size > 0 ? " imglib-selection-bar--active" : ""
        }`}
      >
        <div className="imglib-selection-left">
          <label className="imglib-checkbox-label">
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleSelectPage}
            />
            Select all on page ({paginatedItems.length})
          </label>

          {selectedIds.size > 0 && (
            <>
              <span className="imglib-selected-badge">
                {selectedIds.size} selected
              </span>
              {selectedIds.size < totalFiltered && (
                <button
                  type="button"
                  className="imglib-btn imglib-btn--sm"
                  onClick={selectAllFiltered}
                >
                  Select all {totalFiltered.toLocaleString()} matching
                </button>
              )}
            </>
          )}
        </div>

        <div className="imglib-selection-actions">
          {selectedIds.size > 0 ? (
            <>
              <button
                type="button"
                className="imglib-btn imglib-btn--sm"
                onClick={clearSelection}
              >
                Clear Selection
              </button>
              <button
                type="button"
                className="imglib-btn imglib-btn--sm"
                onClick={() => setShowBulkTagDrawer((v) => !v)}
              >
                <Tag size={13} />
                Bulk Add Tags ({selectedIds.size})
              </button>
              <button
                type="button"
                className="imglib-btn imglib-btn--sm imglib-btn--primary"
                onClick={() => {
                  const selectedObjs = images.filter((i) =>
                    selectedIds.has(i.id)
                  );
                  openBatchEditor(selectedObjs);
                }}
              >
                <Edit3 size={13} />
                Batch Edit Selected ({selectedIds.size})
              </button>
              <button
                type="button"
                className="imglib-btn imglib-btn--sm imglib-btn--danger-solid"
                onClick={() =>
                  setConfirmDeleteModal({
                    ids: Array.from(selectedIds),
                    isBulk: true,
                  })
                }
              >
                <Trash2 size={13} />
                Delete Selected ({selectedIds.size})
              </button>
            </>
          ) : (
            <span style={{ fontSize: 12, color: "#64748b" }}>
              Showing {paginatedItems.length} of{" "}
              {hasActiveFilters
                ? totalFiltered.toLocaleString()
                : displayTotalGalleryCount.toLocaleString()}{" "}
              images
            </span>
          )}
        </div>

        {showBulkTagDrawer && selectedIds.size > 0 && (
          <div className="imglib-bulk-tag-drawer">
            <input
              type="text"
              className="imglib-bulk-tag-input"
              placeholder="Enter comma-separated tags to add to selected images (e.g. nigerian, rice, protein)..."
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleApplyBulkTags();
                }
              }}
            />
            <button
              type="button"
              className="imglib-btn imglib-btn--sm imglib-btn--primary"
              onClick={handleApplyBulkTags}
            >
              Apply Tags
            </button>
            <button
              type="button"
              className="imglib-btn imglib-btn--sm"
              onClick={() => setShowBulkTagDrawer(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Main Content: Initial Skeleton / Empty / 4-Column Grid / Table */}
      {loadingInitial && images.length === 0 ? (
        <div className="imglib-grid">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="imglib-card">
              <div className="imglib-card-media shimmer" />
              <div className="imglib-card-body">
                <div
                  className="shimmer"
                  style={{ height: 16, width: "75%", borderRadius: 4 }}
                />
                <div
                  className="shimmer"
                  style={{ height: 14, width: "50%", borderRadius: 4 }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : paginatedItems.length === 0 ? (
        <div className="imglib-empty">
          <ImageIcon size={36} color="#94a3b8" />
          <h3 className="imglib-empty-title">No images match your search</h3>
          <p className="imglib-empty-sub">
            Try clearing your search query, selecting a different tag, or
            uploading a new image.
          </p>
          <div style={{ display: "inline-flex", gap: 8 }}>
            {hasActiveFilters && (
              <button
                type="button"
                className="imglib-btn"
                onClick={resetAllFilters}
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              className="imglib-btn imglib-btn--primary"
              onClick={() => uploadInputRef.current?.click()}
            >
              <Upload size={14} />
              Upload Image
            </button>
          </div>
        </div>
      ) : viewMode === "grid" ? (
        <div className="imglib-grid">
          {paginatedItems.map((item, idx) => {
            const isSelected = selectedIds.has(item.id);
            const isCopied = copiedId === item.id;
            const isReplacing = replacingId === item.id;
            // Prioritize LCP candidates (first 2 cards) and defer off-screen cards (idx >= 8)
            const isPriorityImage = idx < 2;
            const isDeferredCard = idx >= 8;

            return (
              <article
                key={item.id}
                className={`imglib-card${
                  isSelected ? " imglib-card--selected" : ""
                }${isDeferredCard ? " imglib-card--deferred" : ""}`}
              >
                {/* Media Preview */}
                <div
                  className="imglib-card-media"
                  onClick={() => setDetailModal({ mode: "view", item })}
                >
                  {item.url && !brokenUrls.has(item.url) ? (
                    <img
                      src={item.thumb || item.url}
                      alt={item.name}
                      className="imglib-card-img"
                      {...(isPriorityImage
                        ? { fetchPriority: "high" }
                        : { loading: "lazy", decoding: "async" })}
                      onError={() => {
                        setBrokenUrls((prev) => {
                          const next = new Set(prev);
                          next.add(item.url);
                          return next;
                        });
                      }}
                    />
                  ) : (
                    <div className="imglib-card-missing">
                      <AlertTriangle size={22} />
                      <span>Missing or Broken Image</span>
                      <button
                        type="button"
                        className="imglib-btn imglib-btn--sm"
                        onClick={(e) => triggerQuickReplace(item, e)}
                      >
                        Upload Replacement
                      </button>
                    </div>
                  )}

                  {/* Top-left Selection Checkbox */}
                  <label
                    className="imglib-card-check"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => toggleSelectItem(item.id, e)}
                    />
                  </label>

                  {/* Top-right Quick Actions (Copy URL + Replace Photo) */}
                  <div className="imglib-card-top-actions">
                    <button
                      type="button"
                      className="imglib-media-icon-btn"
                      title="Copy Image URL"
                      onClick={(e) => handleCopyUrl(item, e)}
                    >
                      {isCopied ? (
                        <Check size={14} color="#129575" />
                      ) : (
                        <Copy size={14} />
                      )}
                    </button>
                    <button
                      type="button"
                      className="imglib-media-icon-btn"
                      title="Quick Replace Image File"
                      onClick={(e) => triggerQuickReplace(item, e)}
                      disabled={isReplacing}
                    >
                      <Upload size={14} />
                    </button>
                  </div>
                </div>

                {/* Card Body */}
                <div className="imglib-card-body">
                  <h3
                    className="imglib-card-title"
                    title={item.name}
                    onClick={() => setDetailModal({ mode: "view", item })}
                    style={{ cursor: "pointer" }}
                  >
                    {item.name}
                  </h3>

                  {/* Interactive Removable Tags */}
                  <div className="imglib-card-tags">
                    {(item.tags || []).length === 0 &&
                      (item.synonyms || []).length === 0 && (
                        <button
                          type="button"
                          className="imglib-chip"
                          style={{
                            cursor: "pointer",
                            borderStyle: "dashed",
                            color: "#64748b",
                          }}
                          title="This record came from /api/food-images/ with empty name/tags. Click to add tags."
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailModal({ mode: "edit", item });
                          }}
                        >
                          + Add name / tags
                        </button>
                      )}
                    {(item.tags || []).slice(0, 3).map((tag) => (
                      <span key={tag} className="imglib-chip">
                        <span className="imglib-chip-text">{tag}</span>
                        <button
                          type="button"
                          className="imglib-chip-remove"
                          title={`Remove "${tag}"`}
                          onClick={(e) => handleRemoveSingleTag(item, tag, e)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {(item.tags || []).length > 3 && (
                      <span className="imglib-chip">
                        +{item.tags.length - 3}
                      </span>
                    )}
                    {(item.synonyms || []).slice(0, 2).map((syn) => (
                      <span
                        key={syn}
                        className="imglib-chip imglib-chip--synonym"
                        title="Synonym"
                      >
                        <span className="imglib-chip-text">~ {syn}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Card Footer */}
                <div className="imglib-card-footer">
                  <span className="imglib-card-date">{item.uploadedAt}</span>
                  <div className="imglib-card-actions">
                    <button
                      type="button"
                      className="imglib-card-btn"
                      onClick={() => setDetailModal({ mode: "view", item })}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="imglib-card-btn"
                      title="Edit Image & Tags"
                      onClick={() => setDetailModal({ mode: "edit", item })}
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      type="button"
                      className="imglib-card-btn imglib-card-btn--danger"
                      title="Delete Image"
                      onClick={() =>
                        setConfirmDeleteModal({
                          ids: [item.id],
                          isBulk: false,
                          title: item.name,
                        })
                      }
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="imglib-table-wrap">
          <table className="imglib-table">
            <thead>
              <tr>
                <th style={{ width: 38 }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectPage}
                  />
                </th>
                <th style={{ width: 76 }}>Preview</th>
                <th>Image Name</th>
                <th>Tags</th>
                <th>Synonyms</th>
                <th>Uploaded Date</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <tr key={item.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => toggleSelectItem(item.id, e)}
                      />
                    </td>
                    <td>
                      {item.url && !brokenUrls.has(item.url) ? (
                        <img
                          src={item.thumb || item.url}
                          alt={item.name}
                          className="imglib-table-thumb"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className="imglib-table-thumb"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#fffbeb",
                            color: "#b45309",
                          }}
                        >
                          <AlertTriangle size={14} />
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>
                        {item.name}
                      </div>
                    </td>
                    <td>
                      <div className="imglib-card-tags">
                        {(item.tags || []).map((tag) => (
                          <span key={tag} className="imglib-chip">
                            <span className="imglib-chip-text">{tag}</span>
                            <button
                              type="button"
                              className="imglib-chip-remove"
                              onClick={(e) =>
                                handleRemoveSingleTag(item, tag, e)
                              }
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="imglib-card-tags">
                        {(item.synonyms || []).map((syn) => (
                          <span
                            key={syn}
                            className="imglib-chip imglib-chip--synonym"
                          >
                            <span className="imglib-chip-text">~ {syn}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: "#64748b" }}>
                      {item.uploadedAt}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        style={{
                          display: "inline-flex",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        <button
                          type="button"
                          className="imglib-card-btn"
                          onClick={(e) => handleCopyUrl(item, e)}
                        >
                          <Copy size={12} />
                          Copy URL
                        </button>
                        <button
                          type="button"
                          className="imglib-card-btn"
                          onClick={() => setDetailModal({ mode: "edit", item })}
                        >
                          <Edit3 size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="imglib-card-btn imglib-card-btn--danger"
                          onClick={() =>
                            setConfirmDeleteModal({
                              ids: [item.id],
                              isBulk: false,
                              title: item.name,
                            })
                          }
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination Footer */}
      {totalFiltered > 0 && (
        <div className="imglib-pagination">
          <div className="imglib-pagination-info">
            Showing{" "}
            <strong>
              {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, totalFiltered)}
            </strong>{" "}
            of{" "}
            <strong>
              {hasActiveFilters
                ? totalFiltered.toLocaleString()
                : displayTotalGalleryCount.toLocaleString()}
            </strong>{" "}
            images (Page {safePage} of {totalPages})
          </div>

          <div className="imglib-pagination-controls">
            <button
              type="button"
              className="imglib-page-btn"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} />
              Prev
            </button>
            {paginationRange().map((p, idx) =>
              p === "..." ? (
                <span
                  key={`dots-${idx}`}
                  style={{ padding: "0 6px", color: "#94a3b8" }}
                >
                  ...
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  className={`imglib-page-btn${
                    safePage === p ? " imglib-page-btn--active" : ""
                  }`}
                  onClick={() => setCurrentPage(p)}
                >
                  {p}
                </button>
              )
            )}
            <button
              type="button"
              className="imglib-page-btn"
              disabled={safePage >= totalPages}
              onClick={() =>
                setCurrentPage((p) => Math.min(totalPages, p + 1))
              }
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* View / Edit Image Modal */}
      {detailModal && (
        <AssetDetailModal
          mode={detailModal.mode}
          item={detailModal.item}
          onClose={() => setDetailModal(null)}
          onSave={handleSaveItemEdit}
          onCopyUrl={(item) => handleCopyUrl(item)}
          onDelete={(item) =>
            setConfirmDeleteModal({
              ids: [item.id],
              isBulk: false,
              title: item.name,
            })
          }
        />
      )}

      {/* Add Image by URL Modal */}
      {addUrlModalOpen && (
        <AddByUrlModal
          onClose={() => setAddUrlModalOpen(false)}
          onAdd={async (newItem) => {
            beginMutation();
            try {
              let saved = null;
              try {
                const resData = await api.images.upload({
                  name: newItem.name,
                  food_name: newItem.name,
                  url: newItem.url,
                  image_url: newItem.url,
                  tags: newItem.tags,
                  synonyms: newItem.synonyms,
                });
                saved = normalizeFoodImage(resData);
              } catch (e) {
                // fallback to optimistic item
              }
              const finalItem = saved || newItem;
              editedItemsMapRef.current.set(finalItem.id, finalItem);
              setImages((prev) => {
                const next = [finalItem, ...prev];
                updateCacheIfComplete(next, serverTotalCount + 1);
                return next;
              });
              setServerTotalCount((prev) => prev + 1);
              setAddUrlModalOpen(false);
              showToast(`Added "${finalItem.name}" to Image Library.`);
            } finally {
              endMutation();
            }
          }}
        />
      )}

      {/* Batch Editor Modal */}
      {batchModalOpen && (
        <div
          className="imglib-modal-backdrop"
          onClick={() => setBatchModalOpen(false)}
        >
          <div
            className="imglib-modal imglib-modal--lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="imglib-modal-header">
              <h2 className="imglib-modal-title">
                Batch Edit Gallery Images ({batchDrafts.length})
              </h2>
              <button
                type="button"
                className="imglib-alert-close"
                onClick={() => setBatchModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="imglib-modal-body">
              <div className="imglib-batch-list">
                {batchDrafts.map((d) => (
                  <div
                    key={d.id}
                    className={`imglib-batch-row${
                      d.dirty ? " imglib-batch-row--dirty" : ""
                    }`}
                  >
                    <div className="imglib-batch-thumb-wrap">
                      {d.url ? (
                        <img
                          src={d.url}
                          alt={d.name}
                          className="imglib-batch-thumb"
                        />
                      ) : null}
                    </div>
                    <div>
                      <label className="imglib-label">Image Name</label>
                      <input
                        type="text"
                        className="imglib-input"
                        style={{ width: "100%" }}
                        value={d.name}
                        onChange={(e) =>
                          updateBatchDraft(d.id, "name", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="imglib-label">
                        Tags (comma-separated)
                      </label>
                      <input
                        type="text"
                        className="imglib-input"
                        style={{ width: "100%" }}
                        value={d.tagsInput}
                        onChange={(e) =>
                          updateBatchDraft(d.id, "tagsInput", e.target.value)
                        }
                      />
                    </div>
                    <div>
                      <label className="imglib-label">
                        Synonyms (comma-separated)
                      </label>
                      <input
                        type="text"
                        className="imglib-input"
                        style={{ width: "100%" }}
                        value={d.synonymsInput}
                        onChange={(e) =>
                          updateBatchDraft(d.id, "synonymsInput", e.target.value)
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="imglib-modal-footer">
              <button
                type="button"
                className="imglib-btn"
                onClick={() => setBatchModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="imglib-btn imglib-btn--primary"
                disabled={savingBatch}
                onClick={saveAllBatchDrafts}
              >
                {savingBatch ? "Saving..." : "Save All Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instant Delete Confirmation Modal */}
      {confirmDeleteModal && (
        <div
          className="imglib-modal-backdrop"
          onClick={() => setConfirmDeleteModal(null)}
        >
          <div
            className="imglib-modal imglib-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="imglib-modal-header">
              <h2 className="imglib-modal-title">
                {confirmDeleteModal.isBulk
                  ? `Delete ${confirmDeleteModal.ids.length} Selected Images`
                  : "Delete Image"}
              </h2>
              <button
                type="button"
                className="imglib-alert-close"
                onClick={() => setConfirmDeleteModal(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div className="imglib-modal-body">
              <p style={{ margin: 0, fontSize: 13.5, color: "#334155" }}>
                {confirmDeleteModal.isBulk ? (
                  <>
                    Are you sure you want to permanently delete{" "}
                    <strong>{confirmDeleteModal.ids.length}</strong> selected
                    images from the Image Library?
                  </>
                ) : (
                  <>
                    Are you sure you want to permanently delete{" "}
                    <strong>{confirmDeleteModal.title}</strong> from the Image
                    Library?
                  </>
                )}
              </p>
            </div>
            <div className="imglib-modal-footer">
              <button
                type="button"
                className="imglib-btn"
                onClick={() => setConfirmDeleteModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="imglib-btn imglib-btn--danger-solid"
                onClick={() => executeOptimisticDelete(confirmDeleteModal.ids)}
              >
                <Trash2 size={14} />
                Delete Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetDetailModal({
  mode: initialMode,
  item,
  onClose,
  onSave,
  onCopyUrl,
  onDelete,
}) {
  const [mode, setMode] = useState(initialMode);
  const [name, setName] = useState(item.name || "");
  const [url, setUrl] = useState(item.url || "");
  const [tags, setTags] = useState(() => cleanStringList(item.tags));
  const [tagDraft, setTagDraft] = useState("");
  const [synonymsInput, setSynonymsInput] = useState(
    (item.synonyms || []).join(", ")
  );
  const [uploadingReplace, setUploadingReplace] = useState(false);
  const replaceFileRef = useRef(null);

  const handleAddTag = () => {
    const parts = cleanStringList(tagDraft.split(","));
    if (!parts.length) return;
    setTags((prev) => cleanStringList([...prev, ...parts]));
    setTagDraft("");
  };

  const handleReplaceFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReplace(true);
    try {
      let nextUrl = "";
      if (CloudinaryService.cloudName && CloudinaryService.apiKey) {
        const uploaded = await CloudinaryService.uploadMedia(file, {
          folder: "cookeaze_image_library",
        });
        if (uploaded) nextUrl = uploaded;
      }
      if (!nextUrl) nextUrl = URL.createObjectURL(file);
      setUrl(nextUrl);
    } finally {
      setUploadingReplace(false);
    }
  };

  return (
    <div className="imglib-modal-backdrop" onClick={onClose}>
      <div className="imglib-modal" onClick={(e) => e.stopPropagation()}>
        <div className="imglib-modal-header">
          <h2 className="imglib-modal-title">
            {mode === "edit" ? "Edit Image" : "Image Detail"}
          </h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {mode === "view" && (
              <button
                type="button"
                className="imglib-btn imglib-btn--sm"
                onClick={() => setMode("edit")}
              >
                <Edit3 size={13} />
                Edit
              </button>
            )}
            <button
              type="button"
              className="imglib-alert-close"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="imglib-modal-body">
          <div className="imglib-modal-grid">
            <div className="imglib-modal-preview">
              <div className="imglib-modal-img-wrap">
                {url ? (
                  <img src={url} alt={name} className="imglib-modal-img" />
                ) : (
                  <div className="imglib-card-missing">
                    <AlertTriangle size={24} />
                    <span>No Image URL</span>
                  </div>
                )}
              </div>

              <input
                ref={replaceFileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleReplaceFile}
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                <button
                  type="button"
                  className="imglib-btn imglib-btn--sm"
                  onClick={() => onCopyUrl({ ...item, url, name })}
                >
                  <Copy size={13} />
                  Copy URL
                </button>
                <button
                  type="button"
                  className="imglib-btn imglib-btn--sm"
                  onClick={() => replaceFileRef.current?.click()}
                  disabled={uploadingReplace}
                >
                  <Upload size={13} />
                  {uploadingReplace ? "Uploading..." : "Replace Image"}
                </button>
              </div>
              <span style={{ fontSize: 11.5, color: "#64748b" }}>
                Uploaded: {item.uploadedAt}
              </span>
            </div>

            <div>
              <div className="imglib-form-group">
                <label className="imglib-label">Image Name</label>
                <input
                  type="text"
                  className="imglib-input"
                  value={name}
                  disabled={mode === "view"}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="imglib-form-group">
                <label className="imglib-label">Image URL</label>
                <input
                  type="text"
                  className="imglib-input"
                  value={url}
                  disabled={mode === "view"}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </div>

              <div className="imglib-form-group">
                <label className="imglib-label">Tags</label>
                <div
                  className="imglib-card-tags"
                  style={{ marginBottom: mode === "edit" ? 8 : 0 }}
                >
                  {tags.length === 0 ? (
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>
                      No tags assigned
                    </span>
                  ) : (
                    tags.map((t) => (
                      <span key={t} className="imglib-chip">
                        <span className="imglib-chip-text">{t}</span>
                        {mode === "edit" && (
                          <button
                            type="button"
                            className="imglib-chip-remove"
                            onClick={() =>
                              setTags((prev) => prev.filter((x) => x !== t))
                            }
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))
                  )}
                </div>

                {mode === "edit" && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      className="imglib-input"
                      style={{ flex: 1 }}
                      placeholder="Add tag(s) comma-separated..."
                      value={tagDraft}
                      onChange={(e) => setTagDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="imglib-btn"
                      onClick={handleAddTag}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </div>
                )}
              </div>

              <div className="imglib-form-group">
                <label className="imglib-label">
                  Synonyms (comma-separated)
                </label>
                <input
                  type="text"
                  className="imglib-input"
                  value={synonymsInput}
                  disabled={mode === "view"}
                  placeholder="e.g. party rice, jellof"
                  onChange={(e) => setSynonymsInput(e.target.value)}
                />
              </div>

              {item.rawPayload && (
                <div className="imglib-form-group" style={{ marginBottom: 0 }}>
                  <label className="imglib-label">
                    Raw Backend JSON (/api/food-images/{item.id}/)
                  </label>
                  <pre
                    style={{
                      margin: 0,
                      padding: "8px 10px",
                      background: "#0f172a",
                      color: "#a7f3d0",
                      borderRadius: 8,
                      fontSize: 11,
                      overflowX: "auto",
                      maxHeight: 130,
                    }}
                  >
                    {JSON.stringify(item.rawPayload, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="imglib-modal-footer">
          <button
            type="button"
            className="imglib-btn imglib-btn--danger"
            style={{ marginRight: "auto" }}
            onClick={() => onDelete(item)}
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button type="button" className="imglib-btn" onClick={onClose}>
            Close
          </button>
          {mode === "edit" && (
            <button
              type="button"
              className="imglib-btn imglib-btn--primary"
              onClick={() =>
                onSave({
                  ...item,
                  name,
                  url,
                  thumb: url,
                  tags: cleanStringList([
                    ...tags,
                    ...cleanStringList(tagDraft.split(",")),
                  ]),
                  synonyms: cleanStringList(synonymsInput.split(",")),
                })
              }
            >
              Save Changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function AddByUrlModal({ onClose, onAdd }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [synonymsInput, setSynonymsInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    onAdd({
      id: String(Date.now()),
      name: name.trim() || "Custom Food Image",
      url: url.trim(),
      thumb: url.trim(),
      tags: cleanStringList(tagsInput.split(",")),
      synonyms: cleanStringList(synonymsInput.split(",")),
      uploadedAt: new Date().toISOString().slice(0, 10),
    });
  };

  return (
    <div className="imglib-modal-backdrop" onClick={onClose}>
      <div
        className="imglib-modal imglib-modal--sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="imglib-modal-header">
          <h2 className="imglib-modal-title">Add Image by URL</h2>
          <button
            type="button"
            className="imglib-alert-close"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="imglib-modal-body">
            <div className="imglib-form-group">
              <label className="imglib-label">Image Name</label>
              <input
                type="text"
                className="imglib-input"
                placeholder="e.g. Jollof Rice Classic"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="imglib-form-group">
              <label className="imglib-label">Direct Image URL</label>
              <input
                type="url"
                className="imglib-input"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
            <div className="imglib-form-group">
              <label className="imglib-label">Tags (comma-separated)</label>
              <input
                type="text"
                className="imglib-input"
                placeholder="jollof rice, rice, nigerian"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
              />
            </div>
            <div className="imglib-form-group">
              <label className="imglib-label">Synonyms (comma-separated)</label>
              <input
                type="text"
                className="imglib-input"
                placeholder="party rice, jellof"
                value={synonymsInput}
                onChange={(e) => setSynonymsInput(e.target.value)}
              />
            </div>
          </div>
          <div className="imglib-modal-footer">
            <button type="button" className="imglib-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="imglib-btn imglib-btn--primary">
              Add to Library
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
