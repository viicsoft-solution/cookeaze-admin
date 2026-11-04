// src/components/Home.js
import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Layers,
  LayoutGrid,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  ExternalLink,
  RefreshCw,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

import cloudinaryService from "./cloudinaryService";
import "./Home.css";

const SECTION_TYPE_META = {
  hero_carousel: {
    label: "Hero Carousel",
    hint: "Top rotating showcase slides for featured recipes or themes",
  },
  recipe_grid: {
    label: "Recipe Grid",
    hint: "Standard grid collection of curated recipes",
  },
  themed_recipe_grid: {
    label: "Themed Recipe Grid",
    hint: "Collection of recipe themes (e.g., Fitness, Breakfast)",
  },
  graphic_banner: {
    label: "Graphic Banner",
    hint: "Promotional visual banner linked to a recipe or custom URL",
  },
  creator_spotlight: {
    label: "Creator Spotlight",
    hint: "Highlights featured culinary creators on the home feed",
  },
  exclusive_recipes: {
    label: "Exclusive Recipes",
    hint: "Showcases premium or exclusive recipes only",
  },
};

const SECTIONS_CACHE_KEY = "cookeaze_home_sections_cache_v1";
let memorySectionsCache = null;
const pickerResultsCache = new Map();

const getCachedSections = () => {
  if (Array.isArray(memorySectionsCache) && memorySectionsCache.length > 0) {
    return memorySectionsCache;
  }
  try {
    const raw = sessionStorage.getItem(SECTIONS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memorySectionsCache = parsed;
        return parsed;
      }
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

const saveSectionsCache = (list) => {
  memorySectionsCache = list;
  try {
    sessionStorage.setItem(SECTIONS_CACHE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage errors
  }
};

const HomeSectionAdmin = () => {
  const initialCached = getCachedSections();
  const [sections, setSections] = useState(initialCached || []);
  const [initialLoading, setInitialLoading] = useState(!initialCached);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [deletedItemIds, setDeletedItemIds] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [newSection, setNewSection] = useState({
    type: "recipe_grid",
    title: "",
    order: 0,
    items: [],
  });
  const [filterType, setFilterType] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const [editingItemIndex, setEditingItemIndex] = useState(null);

  // Drag-and-drop state for sections
  const [draggedSectionId, setDraggedSectionId] = useState(null);
  const [dragOverSectionId, setDragOverSectionId] = useState(null);
  const [reorderingSaving, setReorderingSaving] = useState(false);

  // Drag-and-drop state for items inside edit/create
  const [draggedItemIdx, setDraggedItemIdx] = useState(null);
  const [dragOverItemIdx, setDragOverItemIdx] = useState(null);

  const editItemFormRef = useRef(null);

  // Alert state
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState("");

  // Item form state (create)
  const [newItem, setNewItem] = useState({
    item_type: "recipe",
    item_id: "",
    card_color: "#FF5733",
    image_url: "",
    link_url: "",
  });
  const [showItemForm, setShowItemForm] = useState(false);

  // Edit item form state
  const [editItem, setEditItem] = useState({
    item_type: "recipe",
    item_id: "",
    card_color: "#FF5733",
    image_url: "",
    link_url: "",
  });
  const [showEditItemForm, setShowEditItemForm] = useState(false);

  // Modal state
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [showEditSelectModal, setShowEditSelectModal] = useState(false);

  // Available items based on type
  const [availableItems, setAvailableItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Available items for edit mode
  const [editAvailableItems, setEditAvailableItems] = useState([]);
  const [loadingEditItems, setLoadingEditItems] = useState(false);

  // Selected item preview
  const [selectedItemPreview, setSelectedItemPreview] = useState(null);
  const [editItemPreview, setEditItemPreview] = useState(null);

  // Pagination state for create mode
  const [recipesPage, setRecipesPage] = useState(1);
  const [recipesTotalPages, setRecipesTotalPages] = useState(1);
  const [recipesSearch, setRecipesSearch] = useState("");
  const [recipesSearchInput, setRecipesSearchInput] = useState("");

  // Pagination state for edit mode
  const [editRecipesPage, setEditRecipesPage] = useState(1);
  const [editRecipesTotalPages, setEditRecipesTotalPages] = useState(1);
  const [editRecipesSearch, setEditRecipesSearch] = useState("");
  const [editRecipesSearchInput, setEditRecipesSearchInput] = useState("");

  // Cloudinary upload states (create + edit)
  const [newBannerFile, setNewBannerFile] = useState(null);
  const [editBannerFile, setEditBannerFile] = useState(null);
  const [uploadingNewBanner, setUploadingNewBanner] = useState(false);
  const [uploadingEditBanner, setUploadingEditBanner] = useState(false);

  const API_BASE = "https://api.cookeaze.app/api/home-sections";
  const RECIPES_API = "https://api.cookeaze.app/api/recipes/";
  const THEMES_API = "https://api.cookeaze.app/api/themes-recipes/";

  const sectionTypes = [
    "hero_carousel",
    "themed_recipe_grid",
    "recipe_grid",
    "graphic_banner",
    "creator_spotlight",
    "exclusive_recipes",
  ];

  // Fetch sections on mount & automatically re-sync when network reconnects
  useEffect(() => {
    fetchSections(true);
    const handleOnline = () => {
      fetchSections(true);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear alerts after timeout
  useEffect(() => {
    let t;
    if (alertMessage) {
      t = setTimeout(() => {
        setAlertMessage("");
        setAlertType("");
      }, 4000);
    }
    return () => clearTimeout(t);
  }, [alertMessage]);

  // Fetch available items when modal opens or page/search changes (for create)
  useEffect(() => {
    if (showSelectModal && newItem.item_type) {
      fetchAvailableItems(newItem.item_type, recipesPage, recipesSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newItem.item_type, showSelectModal, recipesPage, recipesSearch]);

  // Fetch available items when modal opens or page/search changes (for edit)
  useEffect(() => {
    if (showEditSelectModal && editItem.item_type) {
      fetchEditAvailableItems(
        editItem.item_type,
        editRecipesPage,
        editRecipesSearch
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    editItem.item_type,
    showEditSelectModal,
    editRecipesPage,
    editRecipesSearch,
  ]);

  // Update preview when item_id changes (for create)
  useEffect(() => {
    if (newItem.item_id && availableItems.length > 0) {
      const selected = availableItems.find(
        (item) => item.id === parseInt(newItem.item_id, 10)
      );
      if (selected) setSelectedItemPreview(selected);
    }
  }, [newItem.item_id, availableItems]);

  // Update preview when item_id changes (for edit)
  useEffect(() => {
    if (editItem.item_id && editAvailableItems.length > 0) {
      const selected = editAvailableItems.find(
        (item) => item.id === parseInt(editItem.item_id, 10)
      );
      if (selected) setEditItemPreview(selected);
    }
  }, [editItem.item_id, editAvailableItems]);

  const showAlert = (message, type) => {
    setAlertMessage(message);
    setAlertType(type);
  };

  const isGraphicBanner = (type) => type === "graphic_banner";

  const getDefaultItemTypeForSection = (secType) => {
    if (secType === "creator_spotlight") return "user";
    if (secType === "themed_recipe_grid") return "theme";
    return "recipe";
  };

  const inferItemTypeFromApi = (it, sectionType) => {
    if (
      sectionType === "creator_spotlight" ||
      (it.item?.creator_name && !it.item?.name)
    ) {
      return "user";
    }
    if (sectionType === "themed_recipe_grid" || it.item?.themeName) {
      return "theme";
    }
    return it.itemType || it.item_type || "recipe";
  };

  const getItemDisplayName = (obj) => {
    if (!obj) return "";
    return obj.name || obj.themeName || obj.creator_name || "";
  };

  const getItemDisplayImage = (obj, outerImageUrl) => {
    if (outerImageUrl) return outerImageUrl;
    if (!obj) return "";
    return obj.image_url || obj.themeImage || obj.profile_picture_url || "";
  };

  const hexToArgbInt = (hex) => {
    if (!hex) return parseInt("FFFF5733", 16);
    hex = String(hex).replace("#", "").replace(/^0x/i, "");
    if (hex.length === 6) hex = "FF" + hex;
    return parseInt(hex, 16);
  };

  const normalizeCardColorToInt = (value) => {
    if (value === null || value === undefined || value === "")
      return hexToArgbInt("#FF5733");
    if (typeof value === "number" && !isNaN(value)) return value;
    if (typeof value === "string") {
      if (/^-?\d+$/.test(value)) return parseInt(value, 10);
      return hexToArgbInt(value);
    }
    return hexToArgbInt("#FF5733");
  };

  const argbIntToHex = (argbInt) => {
    if (argbInt === null || argbInt === undefined || argbInt === 0) return null;
    const safeNum = normalizeCardColorToInt(argbInt);
    if (isNaN(safeNum)) return null;
    const hex = (safeNum >>> 0).toString(16).padStart(8, "0");
    return "#" + hex.slice(2);
  };

  const safeCardColorInt = (value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === "number" && !isNaN(value)) return value;
    return normalizeCardColorToInt(value);
  };

  const extractItemColorRaw = (it) => {
    if (it.card_color !== undefined && it.card_color !== null)
      return it.card_color;
    if (it.cardColor !== undefined && it.cardColor !== null)
      return it.cardColor;
    if (it.item?.cardColor !== undefined && it.item?.cardColor !== null)
      return it.item.cardColor;
    if (it.item?.themeColor !== undefined && it.item?.themeColor !== null)
      return it.item.themeColor;
    return null;
  };

  const buildPayloadFromRawSection = (sectionObj, overrideOrder) => {
    const mappedItems = (sectionObj.items || []).map((it) => {
      const isAlreadyMapped = it.item_type !== undefined;
      if (isAlreadyMapped) {
        const out = {
          item_type: it.item_type || "recipe",
          card_color: safeCardColorInt(it.card_color),
        };
        if (it.section_item_id) out.section_item_id = it.section_item_id;
        if (it.item_id) out.item_id = parseInt(it.item_id, 10);
        if (it.image_url) out.image_url = it.image_url;
        if (it.link_url) out.link_url = it.link_url;
        return out;
      }

      const rawColor = extractItemColorRaw(it);
      const out = {
        item_type: inferItemTypeFromApi(it, sectionObj.type),
        card_color:
          rawColor !== null && rawColor !== undefined
            ? safeCardColorInt(rawColor)
            : 0,
      };
      if (it.sectionItemId) out.section_item_id = it.sectionItemId;
      else if (it.section_item_id) out.section_item_id = it.section_item_id;
      if (it.item?.id) out.item_id = parseInt(it.item.id, 10);
      else if (typeof it.itemId === "number") out.item_id = it.itemId;

      if (it.imageUrl) out.image_url = it.imageUrl;
      if (it.linkUrl) out.link_url = it.linkUrl;
      else if (it.link_url) out.link_url = it.link_url;

      return out;
    });

    return {
      title: sectionObj.title || "",
      type: sectionObj.type,
      order:
        overrideOrder !== undefined
          ? overrideOrder
          : parseInt(sectionObj.order, 10) || 0,
      items: mappedItems,
    };
  };

  // Upload helpers
  const uploadNewBannerToCloudinary = async () => {
    if (!newBannerFile) {
      showAlert("Please choose a file first", "warning");
      return;
    }
    try {
      setUploadingNewBanner(true);
      const url = await cloudinaryService.uploadFile(newBannerFile, {
        folder: "cookeaze_uploads",
      });
      setNewItem((prev) => ({ ...prev, image_url: url }));
      showAlert("Banner uploaded successfully", "success");
    } catch (e) {
      console.error(e);
      showAlert("Banner upload failed", "danger");
    } finally {
      setUploadingNewBanner(false);
    }
  };

  const uploadEditBannerToCloudinary = async () => {
    if (!editBannerFile) {
      showAlert("Please choose a file first", "warning");
      return;
    }
    try {
      setUploadingEditBanner(true);
      const url = await cloudinaryService.uploadFile(editBannerFile, {
        folder: "cookeaze_uploads",
      });
      setEditItem((prev) => ({ ...prev, image_url: url }));
      showAlert("Banner uploaded successfully", "success");
    } catch (e) {
      console.error(e);
      showAlert("Banner upload failed", "danger");
    } finally {
      setUploadingEditBanner(false);
    }
  };

  // Fetch sections (active + disabled) progressively so active sections render immediately
  const fetchSections = async (isInitial = false) => {
    try {
      const cached = getCachedSections();
      if (isInitial && !cached) {
        setInitialLoading(true);
      }
      setLoading(true);
      const token = localStorage.getItem("token");

      let activeSections = [];
      let activeSucceeded = false;

      const activePromise = fetch(`${API_BASE}/`, {
        headers: { accept: "application/json" },
      })
        .then((res) => res.json())
        .then((activeData) => {
          if (activeData && activeData.isSuccessful) {
            activeSucceeded = true;
            activeSections = (activeData.data || []).map((s) => ({
              ...s,
              is_active: s.is_active !== undefined ? s.is_active : true,
            }));

            // Render active sections immediately without waiting for the slower /disabled/ endpoint
            if (!cached) {
              const quickSorted = [...activeSections]
                .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                .map((sec, idx) => ({ ...sec, order: idx }));
              setSections(quickSorted);
              setInitialLoading(false);
            }
          }
          return activeData;
        });

      const disabledPromise = fetch(`${API_BASE}/disabled/`, {
        headers: {
          accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })
        .then((res) => res.json())
        .catch(() => ({ isSuccessful: false, data: [] }));

      const [, disabledData] = await Promise.all([
        activePromise,
        disabledPromise,
      ]);

      const disabledSections = disabledData?.isSuccessful
        ? (disabledData.data || []).map((s) => ({ ...s, is_active: false }))
        : [];

      if (activeSucceeded || disabledData?.isSuccessful) {
        // Preserve current relative arrangement: sort by existing order, then active before hidden, then id
        const combined = [...activeSections, ...disabledSections].sort(
          (a, b) => {
            const ordDiff = (a.order ?? 0) - (b.order ?? 0);
            if (ordDiff !== 0) return ordDiff;
            if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
            return (a.id ?? 0) - (b.id ?? 0);
          }
        );

        // Assign unique sequential order numbers (0, 1, 2, ...) so no two sections share the same number
        const sectionsToSync = [];
        const normalized = combined.map((sec, idx) => {
          if (sec.order !== idx) {
            sectionsToSync.push({ ...sec, order: idx });
          }
          return { ...sec, order: idx };
        });

        setSections(normalized);
        saveSectionsCache(normalized);

        // Sync any duplicate/colliding order numbers to backend in the background
        if (sectionsToSync.length > 0) {
          Promise.all(
            sectionsToSync.map((sec) => {
              const payload = buildPayloadFromRawSection(sec, sec.order);
              return fetch(`${API_BASE}/${sec.id}/`, {
                method: "PUT",
                headers: {
                  "Content-Type": "application/json",
                  accept: "application/json",
                },
                body: JSON.stringify(payload),
              });
            })
          ).catch((err) =>
            console.error("Background order normalization failed:", err)
          );
        }
      } else if (!cached) {
        showAlert("Failed to fetch sections", "danger");
      }
    } catch (error) {
      console.error("Error fetching sections:", error);
      if (!getCachedSections()) {
        showAlert("Failed to fetch sections", "danger");
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  // Drag & Drop or Arrow Reorder for Sections
  const persistSectionOrderChanges = async (updatedList, previousMap) => {
    const changedSections = updatedList.filter(
      (sec) => previousMap.get(sec.id) !== sec.order
    );
    if (changedSections.length === 0) return;

    try {
      setReorderingSaving(true);
      await Promise.all(
        changedSections.map((sec) => {
          const payload = buildPayloadFromRawSection(sec, sec.order);
          return fetch(`${API_BASE}/${sec.id}/`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              accept: "application/json",
            },
            body: JSON.stringify(payload),
          });
        })
      );
      showAlert("Section order updated", "success");
    } catch (err) {
      console.error("Error saving new section order:", err);
      showAlert("Failed to save new section order", "danger");
      await fetchSections(false);
    } finally {
      setReorderingSaving(false);
    }
  };

  const handleSectionDrop = async (targetSectionId) => {
    if (
      !draggedSectionId ||
      draggedSectionId === targetSectionId ||
      reorderingSaving
    ) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    const prevOrderMap = new Map(sections.map((s) => [s.id, s.order]));
    const currentList = [...sections];
    const fromIdx = currentList.findIndex((s) => s.id === draggedSectionId);
    const toIdx = currentList.findIndex((s) => s.id === targetSectionId);

    if (fromIdx === -1 || toIdx === -1) {
      setDraggedSectionId(null);
      setDragOverSectionId(null);
      return;
    }

    const [moved] = currentList.splice(fromIdx, 1);
    currentList.splice(toIdx, 0, moved);

    const renumbered = currentList.map((sec, idx) => ({
      ...sec,
      order: idx,
    }));

    setSections(renumbered);
    saveSectionsCache(renumbered);
    if (editingId) {
      const activeEdited = renumbered.find((s) => s.id === editingId);
      if (activeEdited) {
        setEditFormData((prev) => ({ ...prev, order: activeEdited.order }));
      }
    }

    setDraggedSectionId(null);
    setDragOverSectionId(null);

    await persistSectionOrderChanges(renumbered, prevOrderMap);
  };

  const moveSectionByOffset = async (sectionId, offset) => {
    if (reorderingSaving) return;
    const prevOrderMap = new Map(sections.map((s) => [s.id, s.order]));
    const currentList = [...sections];
    const idx = currentList.findIndex((s) => s.id === sectionId);
    const targetIdx = idx + offset;

    if (idx === -1 || targetIdx < 0 || targetIdx >= currentList.length) return;

    const [moved] = currentList.splice(idx, 1);
    currentList.splice(targetIdx, 0, moved);

    const renumbered = currentList.map((sec, i) => ({
      ...sec,
      order: i,
    }));

    setSections(renumbered);
    saveSectionsCache(renumbered);
    if (editingId) {
      const activeEdited = renumbered.find((s) => s.id === editingId);
      if (activeEdited) {
        setEditFormData((prev) => ({ ...prev, order: activeEdited.order }));
      }
    }

    await persistSectionOrderChanges(renumbered, prevOrderMap);
  };

  // Drag & Drop for Items inside Edit Mode
  const handleEditItemDrop = (targetIdx) => {
    if (
      draggedItemIdx === null ||
      draggedItemIdx === targetIdx ||
      !editFormData.items
    ) {
      setDraggedItemIdx(null);
      setDragOverItemIdx(null);
      return;
    }

    const itemsCopy = [...editFormData.items];
    const [moved] = itemsCopy.splice(draggedItemIdx, 1);
    itemsCopy.splice(targetIdx, 0, moved);

    setEditFormData((prev) => ({
      ...prev,
      items: itemsCopy,
    }));

    setDraggedItemIdx(null);
    setDragOverItemIdx(null);
  };

  // Drag & Drop for Items inside Create Mode
  const handleCreateItemDrop = (targetIdx) => {
    if (draggedItemIdx === null || draggedItemIdx === targetIdx) {
      setDraggedItemIdx(null);
      setDragOverItemIdx(null);
      return;
    }

    const itemsCopy = [...newSection.items];
    const [moved] = itemsCopy.splice(draggedItemIdx, 1);
    itemsCopy.splice(targetIdx, 0, moved);

    setNewSection((prev) => ({
      ...prev,
      items: itemsCopy,
    }));

    setDraggedItemIdx(null);
    setDragOverItemIdx(null);
  };

  // Shared cached fetcher for modal item pickers (recipes, creators, themes)
  const fetchPickerItemsCached = async (
    itemType,
    sectionType,
    page = 1,
    search = ""
  ) => {
    const cacheKey = `${itemType}:${
      sectionType === "exclusive_recipes" ? "exclusive" : "std"
    }:${page}:${search}`;

    if (pickerResultsCache.has(cacheKey)) {
      return pickerResultsCache.get(cacheKey);
    }

    if (itemType === "recipe") {
      let apiUrl =
        sectionType === "exclusive_recipes"
          ? `https://api.cookeaze.app/api/recipes/exclusive/?page=${page}`
          : `${RECIPES_API}?page=${page}`;
      if (search) apiUrl += `&search=${encodeURIComponent(search)}`;

      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
      });
      const data = await response.json();

      if (data.isSuccessful) {
        const list = data.data.results || [];
        const totalCount = data.data.count || 0;
        const itemsPerPage = list.length || 10;
        const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
        const res = { ok: true, list, totalPages };
        pickerResultsCache.set(cacheKey, res);
        return res;
      }
      return { ok: false, list: [], totalPages: 1 };
    }

    if (itemType === "user") {
      let apiUrl = `https://api.cookeaze.app/api/creators/?page=${page}`;
      if (search) apiUrl += `&search=${encodeURIComponent(search)}`;

      const response = await fetch(apiUrl, {
        headers: { accept: "application/json" },
      });
      const data = await response.json();

      if (data.isSuccessful) {
        const list = data.data || [];
        const totalPages = data.pagination?.total_pages || 1;
        const res = { ok: true, list, totalPages };
        pickerResultsCache.set(cacheKey, res);
        return res;
      }
      return { ok: false, list: [], totalPages: 1 };
    }

    const response = await fetch(THEMES_API, {
      headers: { accept: "application/json" },
    });
    const data = await response.json();

    if (data.isSuccessful) {
      const list = data.data?.results || data.data || [];
      const safeList = Array.isArray(list) ? list : [];
      const res = { ok: true, list: safeList, totalPages: 1 };
      pickerResultsCache.set(cacheKey, res);
      return res;
    }
    return { ok: false, list: [], totalPages: 1 };
  };

  // Fetch available items (create)
  const fetchAvailableItems = async (itemType, page = 1, search = "") => {
    try {
      setLoadingItems(true);
      const res = await fetchPickerItemsCached(
        itemType,
        newSection.type,
        page,
        search
      );
      if (res.ok) {
        setAvailableItems(res.list);
        setRecipesTotalPages(res.totalPages);
      } else {
        showAlert(`Failed to fetch ${itemType}s`, "warning");
        setAvailableItems([]);
      }
    } catch (error) {
      console.error(`Error fetching ${itemType}s:`, error);
      showAlert(`Failed to fetch ${itemType}s`, "danger");
      setAvailableItems([]);
    } finally {
      setLoadingItems(false);
    }
  };

  // Fetch available items (edit)
  const fetchEditAvailableItems = async (itemType, page = 1, search = "") => {
    try {
      setLoadingEditItems(true);
      const res = await fetchPickerItemsCached(
        itemType,
        editFormData.type,
        page,
        search
      );
      if (res.ok) {
        setEditAvailableItems(res.list);
        setEditRecipesTotalPages(res.totalPages);
      } else {
        showAlert(`Failed to fetch ${itemType}s`, "warning");
        setEditAvailableItems([]);
      }
    } catch (error) {
      console.error(`Error fetching ${itemType}s:`, error);
      showAlert(`Failed to fetch ${itemType}s`, "danger");
      setEditAvailableItems([]);
    } finally {
      setLoadingEditItems(false);
    }
  };

  const handleRecipesSearch = () => {
    setRecipesSearch(recipesSearchInput);
    setRecipesPage(1);
  };

  const handleEditRecipesSearch = () => {
    setEditRecipesSearch(editRecipesSearchInput);
    setEditRecipesPage(1);
  };

  const openSelectModal = () => {
    setShowSelectModal(true);
    setRecipesPage(1);
    setRecipesSearch("");
    setRecipesSearchInput("");
  };

  const openEditSelectModal = () => {
    setShowEditSelectModal(true);
    setEditRecipesPage(1);
    setEditRecipesSearch("");
    setEditRecipesSearchInput("");
  };

  const selectItemFromModal = (item) => {
    setNewItem({ ...newItem, item_id: item.id.toString() });
    setSelectedItemPreview(item);
    setShowSelectModal(false);
  };

  const selectEditItemFromModal = (item) => {
    setEditItem({ ...editItem, item_id: item.id.toString() });
    setEditItemPreview(item);
    setShowEditSelectModal(false);
  };

  // Create new section
  const createSection = async () => {
    if (!newSection.title.trim()) {
      showAlert("Please enter a section title", "warning");
      return;
    }

    try {
      setLoading(true);
      const payload = {
        title: newSection.title || "",
        type: newSection.type,
        order: parseInt(newSection.order, 10) || 0,
        items: newSection.items.map((item) => {
          const mappedItem = {
            item_type: item.item_type || "recipe",
            card_color: safeCardColorInt(item.card_color),
          };
          if (item.item_id) mappedItem.item_id = parseInt(item.item_id, 10);
          if (item.image_url) mappedItem.image_url = item.image_url;
          if (item.link_url) mappedItem.link_url = item.link_url;
          return mappedItem;
        }),
      };

      const response = await fetch(`${API_BASE}/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.isSuccessful) {
        await fetchSections(false);
        setNewSection({
          title: "",
          type: "recipe_grid",
          order: sections.length,
          items: [],
        });
        setShowForm(false);
        setNewItem({
          item_type: "recipe",
          item_id: "",
          card_color: "#FF5733",
          image_url: "",
          link_url: "",
        });
        setShowItemForm(false);
        setSelectedItemPreview(null);
        setRecipesPage(1);
        setRecipesSearch("");
        setRecipesSearchInput("");
        setNewBannerFile(null);
        setUploadingNewBanner(false);
        showAlert("Section created successfully", "success");
      } else {
        showAlert(data.message || "Failed to create section", "danger");
      }
    } catch (error) {
      console.error("Error creating section:", error);
      showAlert("Failed to create section", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Update section
  const updateSection = async (id) => {
    if (!editFormData.title?.trim()) {
      showAlert("Please enter a section title", "warning");
      return;
    }

    try {
      setLoading(true);

      // If an item sub-editor is currently open when "Save Changes" is clicked,
      // merge its pending edits (like card_color) into that item so no item is missed or overwritten.
      let itemsToPersist = [...(editFormData.items || [])];
      if (
        showEditItemForm &&
        editingItemIndex !== null &&
        itemsToPersist[editingItemIndex]
      ) {
        const pendingTarget = itemsToPersist[editingItemIndex];
        itemsToPersist[editingItemIndex] = {
          ...pendingTarget,
          item_type: editItem.item_type || pendingTarget.item_type,
          item_id: editItem.item_id
            ? parseInt(editItem.item_id, 10)
            : pendingTarget.item_id,
          card_color: hexToArgbInt(editItem.card_color),
          image_url: editItem.image_url || pendingTarget.image_url,
          link_url: editItem.link_url || pendingTarget.link_url,
        };
      }

      const payload = {
        title: editFormData.title || "",
        type: editFormData.type,
        order: parseInt(editFormData.order, 10) || 0,
        items: itemsToPersist.map((item) => {
          const mappedItem = {
            item_type: item.item_type || "recipe",
            card_color: safeCardColorInt(item.card_color),
          };
          if (item.section_item_id) {
            mappedItem.section_item_id = item.section_item_id;
          }
          if (item.item_id) mappedItem.item_id = parseInt(item.item_id, 10);
          if (item.image_url) mappedItem.image_url = item.image_url;
          if (item.link_url) mappedItem.link_url = item.link_url;
          return mappedItem;
        }),
      };

      if (deletedItemIds.length > 0) {
        await Promise.all(
          deletedItemIds.map((sid) =>
            fetch(`${API_BASE}/${id}/remove-item/`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                accept: "application/json",
              },
              body: JSON.stringify({ section_item_id: sid }),
            })
          )
        );
      }

      const response = await fetch(`${API_BASE}/${id}/`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.isSuccessful) {
        setEditingId(null);
        setEditFormData({});
        setEditingItemIndex(null);
        setShowEditItemForm(false);
        setDeletedItemIds([]);
        setEditRecipesPage(1);
        setEditRecipesSearch("");
        setEditRecipesSearchInput("");
        setEditBannerFile(null);
        setUploadingEditBanner(false);
        showAlert("Section updated successfully", "success");
        fetchSections(false);
      } else {
        showAlert(data.message || "Failed to update section", "danger");
      }
    } catch (error) {
      console.error("Error updating section:", error);
      showAlert("Failed to update section", "danger");
    } finally {
      setLoading(false);
    }
  };

  // Optimistic toggle visibility
  const toggleVisibility = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    const prevSections = sections;
    const optimisticList = sections.map((s) =>
      s.id === id ? { ...s, is_active: nextStatus } : s
    );
    setSections(optimisticList);
    saveSectionsCache(optimisticList);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_BASE}/${id}/toggle-visibility/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_active: nextStatus }),
      });
      const data = await response.json();

      if (data.isSuccessful) {
        showAlert(
          data.message ||
            `Section is now ${nextStatus ? "active" : "hidden"}.`,
          "success"
        );
      } else {
        setSections(prevSections);
        saveSectionsCache(prevSections);
        showAlert(data.message || "Failed to toggle visibility", "danger");
      }
    } catch (error) {
      console.error("Error toggling visibility:", error);
      setSections(prevSections);
      saveSectionsCache(prevSections);
      showAlert("Failed to toggle visibility", "danger");
    }
  };

  // Delete section
  const deleteSection = (id) => {
    setSelectedId(id);
    setShowConfirm(true);
  };

  const confirmDelete = async () => {
    const idToDelete = selectedId;
    const prevSections = sections;
    const optimisticRemaining = sections
      .filter((s) => s.id !== idToDelete)
      .map((s, idx) => ({ ...s, order: idx }));

    setShowConfirm(false);
    setSelectedId(null);
    setSections(optimisticRemaining);
    saveSectionsCache(optimisticRemaining);

    try {
      const response = await fetch(`${API_BASE}/${idToDelete}/`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });

      if (response.ok) {
        showAlert("Section deleted successfully", "success");
      } else {
        setSections(prevSections);
        saveSectionsCache(prevSections);
        showAlert("Failed to delete section", "danger");
      }
    } catch (error) {
      console.error("Error deleting section:", error);
      setSections(prevSections);
      saveSectionsCache(prevSections);
      showAlert("Failed to delete section", "danger");
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setSelectedId(null);
  };

  // Add item to section (create)
  const addItemToSection = () => {
    const isGraphicBannerSection = isGraphicBanner(newSection.type);

    if (isGraphicBannerSection) {
      if (newItem.item_id) {
        if (!newItem.image_url) {
          showAlert("Please upload an image first", "warning");
          return;
        }
      } else {
        if (!newItem.image_url || !newItem.link_url) {
          showAlert("Please provide both banner image and link URL", "warning");
          return;
        }
      }
    } else {
      if (!newItem.item_id) {
        showAlert("Please select an item", "warning");
        return;
      }
    }

    const item = {
      item_type: newItem.item_type,
      card_color: hexToArgbInt(newItem.card_color),
      _previewName: getItemDisplayName(selectedItemPreview),
      _previewImage: getItemDisplayImage(
        selectedItemPreview,
        newItem.image_url
      ),
    };

    if (newItem.item_id) item.item_id = parseInt(newItem.item_id, 10);

    if (isGraphicBannerSection) {
      if (newItem.image_url) item.image_url = newItem.image_url;
      if (newItem.link_url) item.link_url = newItem.link_url;
    }

    setNewSection((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));

    setNewItem({
      item_type: getDefaultItemTypeForSection(newSection.type),
      item_id: "",
      card_color: "#FF5733",
      image_url: "",
      link_url: "",
    });
    setNewBannerFile(null);
    setUploadingNewBanner(false);
    setShowItemForm(false);
    setSelectedItemPreview(null);
    showAlert("Item added to section", "success");
  };

  // Add/update item in edit section
  const addItemToEditSection = () => {
    const isGraphicBannerSection = isGraphicBanner(editFormData.type);

    if (isGraphicBannerSection) {
      if (editItem.item_id) {
        if (!editItem.image_url) {
          showAlert("Please upload an image first", "warning");
          return;
        }
      } else {
        if (!editItem.image_url || !editItem.link_url) {
          showAlert("Please provide both banner image and link URL", "warning");
          return;
        }
      }
    } else {
      if (!editItem.item_id) {
        showAlert("Please select an item", "warning");
        return;
      }
    }

    const item = {
      item_type: editItem.item_type,
      card_color: hexToArgbInt(editItem.card_color),
      _previewName: getItemDisplayName(editItemPreview),
      _previewImage: getItemDisplayImage(
        editItemPreview,
        editItem.image_url
      ),
    };

    if (editItem.item_id) item.item_id = parseInt(editItem.item_id, 10);

    if (isGraphicBannerSection) {
      if (editItem.image_url) item.image_url = editItem.image_url;
      if (editItem.link_url) item.link_url = editItem.link_url;
    }

    setEditFormData((prev) => {
      const prevItems = prev.items || [];

      if (editingItemIndex !== null && prevItems[editingItemIndex]) {
        const updated = [...prevItems];
        if (updated[editingItemIndex].section_item_id) {
          item.section_item_id = updated[editingItemIndex].section_item_id;
        }
        updated[editingItemIndex] = item;
        return { ...prev, items: updated };
      }

      return { ...prev, items: [...prevItems, item] };
    });

    setEditItem({
      item_type: getDefaultItemTypeForSection(editFormData.type),
      item_id: "",
      card_color: "#FF5733",
      image_url: "",
      link_url: "",
    });
    setEditBannerFile(null);
    setUploadingEditBanner(false);
    setShowEditItemForm(false);
    setEditItemPreview(null);
    setEditingItemIndex(null);

    showAlert(
      editingItemIndex !== null ? "Item updated" : "Item added to section",
      "success"
    );
  };

  const removeItemFromSection = (indexToRemove) => {
    setNewSection((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== indexToRemove),
    }));
  };

  const removeItemFromEditSection = (indexToRemove) => {
    const itemToRemove = editFormData.items[indexToRemove];

    if (itemToRemove && itemToRemove.section_item_id) {
      setDeletedItemIds((prev) => [...prev, itemToRemove.section_item_id]);
    }

    setEditFormData((prev) => ({
      ...prev,
      items: (prev.items || []).filter((_, i) => i !== indexToRemove),
    }));

    if (editingItemIndex === indexToRemove) {
      setEditingItemIndex(null);
      setShowEditItemForm(false);
      setEditItemPreview(null);
      setEditItem({
        item_type: getDefaultItemTypeForSection(editFormData.type),
        item_id: "",
        card_color: "#FF5733",
        image_url: "",
        link_url: "",
      });
    }
  };

  const closeSectionDrawerOrEdit = () => {
    setEditingId(null);
    setExpandedId(null);
    setEditFormData({});
    setDeletedItemIds([]);
    setShowEditItemForm(false);
    setEditingItemIndex(null);
    setEditItemPreview(null);
  };

  const startEditingSection = (section) => {
    setEditingId(section.id);
    setExpandedId(null);
    setEditingItemIndex(null);
    setDeletedItemIds([]);
    setShowEditItemForm(false);
    setEditItemPreview(null);

    const editableItems =
      section.items?.map((it) => {
        const rawColor = extractItemColorRaw(it);
        const mappedItem = {
          item_type: inferItemTypeFromApi(it, section.type),
          card_color:
            rawColor !== null && rawColor !== undefined
              ? typeof rawColor === "number"
                ? rawColor
                : normalizeCardColorToInt(rawColor)
              : 0,
          _previewName: getItemDisplayName(it.item),
          _previewImage: getItemDisplayImage(it.item, it.imageUrl),
        };

        if (it.sectionItemId) {
          mappedItem.section_item_id = it.sectionItemId;
        }

        if (it.item?.id) mappedItem.item_id = it.item.id;
        else if (typeof it.itemId === "number") mappedItem.item_id = it.itemId;

        if (it.imageUrl) mappedItem.image_url = it.imageUrl;

        if (it.linkUrl) mappedItem.link_url = it.linkUrl;
        else if (it.link_url) mappedItem.link_url = it.link_url;

        return mappedItem;
      }) || [];

    setEditFormData({ ...section, items: editableItems });
    setEditBannerFile(null);
    setUploadingEditBanner(false);
  };

  const filteredSections = sections.filter((section) => {
    const matchesType = filterType === "all" || section.type === filterType;
    const matchesSearch = (section.title || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());

    let matchesVisibility = true;
    if (visibilityFilter === "visible") {
      matchesVisibility = section.is_active === true;
    } else if (visibilityFilter === "hidden") {
      matchesVisibility = section.is_active === false;
    }

    return matchesType && matchesSearch && matchesVisibility;
  });

  const totalVisibleCount = sections.filter((s) => s.is_active).length;
  const totalHiddenCount = sections.filter((s) => !s.is_active).length;
  const totalItemsCount = sections.reduce(
    (sum, s) => sum + (s.items?.length || 0),
    0
  );

  // Shimmer skeleton during initial data fetch
  if (initialLoading) {
    return (
      <div className="hsm-page">
        <header className="hsm-header">
          <div>
            <h1 className="hsm-title">Home Section Manager</h1>
            <p className="hsm-subtitle">
              Configure and order sections displayed on the Cookeaze mobile home screen.
            </p>
          </div>
          <div
            className="shimmer"
            style={{ width: 170, height: 36, borderRadius: 7 }}
          />
        </header>

        <div className="hsm-kpi-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="hsm-kpi-card">
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

        <div className="hsm-filter-panel">
          <div className="hsm-filter-top">
            <div
              className="shimmer"
              style={{ width: 320, height: 36, borderRadius: 7 }}
            />
            <div
              className="shimmer"
              style={{ width: 240, height: 34, borderRadius: 7 }}
            />
          </div>
          <div className="hsm-type-tabs-bar">
            <div className="d-flex gap-2">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="shimmer"
                  style={{ width: 110, height: 30, borderRadius: 6 }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="hsm-table-container">
          {[1, 2, 3, 4, 5, 6].map((row) => (
            <div key={row} className="hsm-section-item">
              <div className="hsm-section-row">
                <div className="shimmer" style={{ width: 56, height: 28 }} />
                <div className="shimmer" style={{ width: "75%", height: 18 }} />
                <div className="shimmer" style={{ width: 120, height: 16 }} />
                <div className="shimmer" style={{ width: 140, height: 28 }} />
                <div className="shimmer" style={{ width: 90, height: 20 }} />
                <div className="shimmer" style={{ width: 170, height: 30 }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="hsm-page">
      {/* Header */}
      <header className="hsm-header">
        <div>
          <h1 className="hsm-title">Home Section Manager</h1>
          <p className="hsm-subtitle">
            Configure and order sections displayed on the Cookeaze mobile home screen.
          </p>
        </div>

        <div className="hsm-header-actions">
          <button
            type="button"
            className="hsm-btn"
            onClick={() => fetchSections(false)}
            disabled={loading || reorderingSaving}
            title="Refresh sections"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const nextState = !showForm;
              setShowForm(nextState);
              if (nextState) {
                setNewSection((prev) => ({
                  ...prev,
                  order: sections.length,
                }));
                setNewItem((prev) => ({
                  ...prev,
                  item_type: getDefaultItemTypeForSection(newSection.type),
                }));
              }
            }}
            className={`hsm-btn ${showForm ? "" : "hsm-btn--primary"}`}
          >
            {showForm ? <X size={15} /> : <Plus size={15} />}
            <span>{showForm ? "Close Form" : "New Section"}</span>
          </button>
        </div>
      </header>

      {/* KPI Summary Strip */}
      <section className="hsm-kpi-grid" aria-label="Home Sections Overview">
        <div className="hsm-kpi-card">
          <div>
            <div className="hsm-kpi-label">Total Sections</div>
            <div className="hsm-kpi-value">{sections.length}</div>
          </div>
          <div className="hsm-kpi-icon">
            <Layers size={18} />
          </div>
        </div>

        <div className="hsm-kpi-card">
          <div>
            <div className="hsm-kpi-label">Active on App</div>
            <div className="hsm-kpi-value">{totalVisibleCount}</div>
          </div>
          <div className="hsm-kpi-icon">
            <Eye size={18} />
          </div>
        </div>

        <div className="hsm-kpi-card">
          <div>
            <div className="hsm-kpi-label">Hidden Sections</div>
            <div className="hsm-kpi-value">{totalHiddenCount}</div>
          </div>
          <div className="hsm-kpi-icon">
            <EyeOff size={18} />
          </div>
        </div>

        <div className="hsm-kpi-card">
          <div>
            <div className="hsm-kpi-label">Curated Items</div>
            <div className="hsm-kpi-value">{totalItemsCount}</div>
          </div>
          <div className="hsm-kpi-icon">
            <LayoutGrid size={18} />
          </div>
        </div>
      </section>

      {/* Alert Banner */}
      {alertMessage && (
        <div
          className={`hsm-alert hsm-alert--${alertType || "success"}`}
          role="alert"
        >
          <div className="d-flex align-items-center gap-2">
            {alertType === "danger" || alertType === "warning" ? (
              <AlertCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            <span>{alertMessage}</span>
          </div>
          <button
            type="button"
            className="hsm-btn hsm-btn--sm"
            onClick={() => setAlertMessage("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create New Section Panel */}
      {showForm && (
        <section className="hsm-editor-panel" aria-label="Create New Section">
          <div className="hsm-editor-header">
            <h2 className="hsm-editor-title">
              <Plus size={16} />
              <span>Create New Home Section</span>
            </h2>
            <button
              type="button"
              className="hsm-btn hsm-btn--icon"
              onClick={() => setShowForm(false)}
              title="Close form"
            >
              <X size={15} />
            </button>
          </div>

          <div className="hsm-editor-body">
            <div className="hsm-form-grid">
              <div>
                <label className="hsm-field-label">Section Title</label>
                <input
                  type="text"
                  placeholder="e.g., Weekend Grills & Roasts"
                  value={newSection.title}
                  onChange={(e) =>
                    setNewSection({ ...newSection, title: e.target.value })
                  }
                  className="hsm-input"
                />
              </div>

              <div>
                <label className="hsm-field-label">Section Layout Type</label>
                <select
                  value={newSection.type}
                  onChange={(e) => {
                    const newType = e.target.value;
                    setNewSection({ ...newSection, type: newType });
                    setNewItem((prev) => ({
                      ...prev,
                      item_type: getDefaultItemTypeForSection(newType),
                      item_id: "",
                    }));
                    setSelectedItemPreview(null);
                  }}
                  className="hsm-select"
                >
                  {sectionTypes.map((type) => (
                    <option key={type} value={type}>
                      {SECTION_TYPE_META[type]?.label || type} ({type})
                    </option>
                  ))}
                </select>
                <div className="hsm-type-hint">
                  {SECTION_TYPE_META[newSection.type]?.hint}
                </div>
              </div>

              <div>
                <label className="hsm-field-label">Display Order</label>
                <input
                  type="number"
                  placeholder="0"
                  value={newSection.order}
                  onChange={(e) =>
                    setNewSection({
                      ...newSection,
                      order: parseInt(e.target.value, 10) || 0,
                    })
                  }
                  className="hsm-input"
                />
                <div className="hsm-type-hint">Position index (0, 1, 2...)</div>
              </div>
            </div>

            {/* Section Items Sub-Box */}
            <div className="hsm-items-box">
              <div className="hsm-items-box-header">
                <h3 className="hsm-items-box-title">
                  <span>Section Items ({newSection.items.length})</span>
                  {newSection.items.length > 1 && (
                    <span className="hsm-drag-hint">
                      • Drag cards to reorder
                    </span>
                  )}
                </h3>
                {!showItemForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewItem({
                        item_type: getDefaultItemTypeForSection(
                          newSection.type
                        ),
                        item_id: "",
                        card_color: "#FF5733",
                        image_url: "",
                        link_url: "",
                      });
                      setShowItemForm(true);
                    }}
                    className="hsm-btn hsm-btn--sm hsm-btn--primary"
                  >
                    <Plus size={14} />
                    <span>Add Item</span>
                  </button>
                )}
              </div>

              {/* Add Item Builder */}
              {showItemForm && (
                <div className="hsm-item-builder-card">
                  <div className="hsm-item-builder-header">
                    <h4 className="hsm-item-builder-title">Add New Item</h4>
                    <button
                      type="button"
                      className="hsm-btn hsm-btn--icon"
                      style={{ width: 28, height: 28 }}
                      onClick={() => {
                        setShowItemForm(false);
                        setSelectedItemPreview(null);
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="hsm-item-builder-grid">
                    <div>
                      <label className="hsm-field-label">Content Type</label>
                      <select
                        value={newItem.item_type}
                        onChange={(e) => {
                          setNewItem({
                            ...newItem,
                            item_type: e.target.value,
                            item_id: "",
                          });
                          setSelectedItemPreview(null);
                        }}
                        className="hsm-select"
                        disabled={
                          newSection.type === "creator_spotlight" ||
                          newSection.type === "exclusive_recipes"
                        }
                      >
                        {newSection.type === "creator_spotlight" ? (
                          <option value="user">Creator (User)</option>
                        ) : newSection.type === "exclusive_recipes" ? (
                          <option value="recipe">Exclusive Recipe</option>
                        ) : (
                          <>
                            <option value="recipe">Recipe</option>
                            <option value="theme">Theme</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="hsm-field-label">
                        {isGraphicBanner(newSection.type)
                          ? "Linked Item (Optional)"
                          : "Select Content"}
                      </label>
                      <button
                        type="button"
                        onClick={openSelectModal}
                        className="hsm-btn w-100 justify-content-between"
                      >
                        <span className="text-truncate">
                          {newItem.item_id
                            ? `${
                                getItemDisplayName(selectedItemPreview) ||
                                `ID #${newItem.item_id}`
                              }`
                            : `Choose ${newItem.item_type}...`}
                        </span>
                        <Search size={14} />
                      </button>
                    </div>

                    <div>
                      <label className="hsm-field-label">
                        Card Accent Color
                      </label>
                      <div className="hsm-color-row">
                        <input
                          type="color"
                          value={newItem.card_color}
                          onChange={(e) =>
                            setNewItem({
                              ...newItem,
                              card_color: e.target.value,
                            })
                          }
                          className="hsm-color-input"
                        />
                        <span className="hsm-section-sub">
                          {newItem.card_color.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isGraphicBanner(newSection.type) && (
                    <div className="hsm-item-builder-grid">
                      <div>
                        <label className="hsm-field-label">
                          Banner Artwork Upload
                        </label>
                        <div className="d-flex gap-2">
                          <input
                            type="file"
                            accept="image/*,video/*"
                            className="hsm-input"
                            onChange={(e) =>
                              setNewBannerFile(e.target.files?.[0] || null)
                            }
                          />
                          <button
                            type="button"
                            className="hsm-btn"
                            onClick={uploadNewBannerToCloudinary}
                            disabled={uploadingNewBanner || !newBannerFile}
                          >
                            {uploadingNewBanner ? "Uploading..." : "Upload"}
                          </button>
                        </div>
                        {newItem.image_url && (
                          <div className="hsm-type-hint text-truncate">
                            Uploaded: {newItem.image_url}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="hsm-field-label">
                          External Link URL{" "}
                          {!newItem.item_id && "(Required if no recipe linked)"}
                        </label>
                        <input
                          type="text"
                          placeholder="https://..."
                          value={newItem.link_url}
                          onChange={(e) =>
                            setNewItem({ ...newItem, link_url: e.target.value })
                          }
                          className="hsm-input"
                        />
                      </div>
                    </div>
                  )}

                  {selectedItemPreview && (
                    <div className="hsm-selected-preview">
                      {getItemDisplayImage(selectedItemPreview) && (
                        <img
                          src={getItemDisplayImage(selectedItemPreview)}
                          alt={getItemDisplayName(selectedItemPreview)}
                          className="hsm-selected-thumb"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      )}
                      <div>
                        <div className="hsm-item-name">
                          {getItemDisplayName(selectedItemPreview)}
                        </div>
                        <div className="hsm-item-meta">
                          ID #{selectedItemPreview.id}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      onClick={addItemToSection}
                      className="hsm-btn hsm-btn--sm hsm-btn--primary"
                      disabled={
                        isGraphicBanner(newSection.type)
                          ? !newItem.image_url ||
                            (!newItem.item_id && !newItem.link_url)
                          : !newItem.item_id
                      }
                    >
                      <Plus size={14} />
                      <span>Confirm Item</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowItemForm(false);
                        setSelectedItemPreview(null);
                      }}
                      className="hsm-btn hsm-btn--sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Queued Items in Create Form */}
              {newSection.items.length > 0 ? (
                <div className="hsm-items-grid">
                  {newSection.items.map((item, idx) => {
                    const swatchColor = argbIntToHex(item.card_color);
                    const isDragged = draggedItemIdx === idx;
                    const isDragOver = dragOverItemIdx === idx;
                    return (
                      <div
                        key={`${item.item_id ?? "noid"}-${idx}`}
                        draggable
                        onDragStart={() => setDraggedItemIdx(idx)}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (dragOverItemIdx !== idx) setDragOverItemIdx(idx);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          handleCreateItemDrop(idx);
                        }}
                        onDragEnd={() => {
                          setDraggedItemIdx(null);
                          setDragOverItemIdx(null);
                        }}
                        className={`hsm-item-card hsm-item-card--draggable ${
                          isDragged ? "hsm-item-card--dragging" : ""
                        } ${isDragOver ? "hsm-item-card--dragover" : ""}`}
                      >
                        <div className="hsm-item-card-left">
                          <span
                            className="hsm-drag-grip"
                            title="Drag to reorder item"
                          >
                            <GripVertical size={15} />
                          </span>
                          {item._previewImage ? (
                            <img
                              src={item._previewImage}
                              alt={item._previewName || "Item"}
                              className="hsm-item-thumb"
                            />
                          ) : (
                            <div className="hsm-item-thumb-placeholder">
                              <ImageIcon size={17} />
                            </div>
                          )}
                          <div className="hsm-item-info">
                            <div className="hsm-item-name">
                              {item._previewName ||
                                (item.item_id
                                  ? `${item.item_type} #${item.item_id}`
                                  : "Banner Item")}
                            </div>
                            <div className="hsm-item-meta">
                              <span>{item.item_type}</span>
                              {item.item_id && <span>• ID #{item.item_id}</span>}
                              <label
                                className="hsm-inline-color-picker"
                                title="Click to change this item's card color"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="color"
                                  value={swatchColor || "#FF5733"}
                                  onChange={(e) => {
                                    const newColorInt = hexToArgbInt(
                                      e.target.value
                                    );
                                    setNewSection((prev) => {
                                      const updatedItems = [
                                        ...(prev.items || []),
                                      ];
                                      if (updatedItems[idx]) {
                                        updatedItems[idx] = {
                                          ...updatedItems[idx],
                                          card_color: newColorInt,
                                        };
                                      }
                                      return {
                                        ...prev,
                                        items: updatedItems,
                                      };
                                    });
                                  }}
                                  className="hsm-inline-color-input"
                                />
                                <span
                                  className="hsm-swatch hsm-swatch--interactive"
                                  style={{
                                    backgroundColor: swatchColor || "#cbd5e1",
                                  }}
                                />
                                <span className="hsm-inline-color-hex">
                                  {swatchColor
                                    ? swatchColor.toUpperCase()
                                    : "Color"}
                                </span>
                              </label>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItemFromSection(idx)}
                          className="hsm-btn hsm-btn--icon hsm-btn--danger"
                          title="Remove item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                !showItemForm && (
                  <div className="hsm-section-sub">
                    No items added yet. Click &ldquo;Add Item&rdquo; to populate this section.
                  </div>
                )
              )}
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                onClick={createSection}
                className="hsm-btn hsm-btn--primary"
                disabled={loading}
              >
                <Save size={15} />
                <span>{loading ? "Saving..." : "Create Section"}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="hsm-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Clean Filter & Search Panel */}
      <div className="hsm-filter-panel">
        <div className="hsm-filter-top">
          <div className="hsm-search-wrap">
            <Search size={15} className="hsm-search-icon" />
            <input
              type="text"
              placeholder="Search sections by title..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="hsm-input hsm-input--search"
            />
            {searchTerm && (
              <button
                type="button"
                className="hsm-search-clear"
                onClick={() => setSearchTerm("")}
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div
            className="hsm-status-tabs"
            role="group"
            aria-label="Visibility filter"
          >
            <button
              type="button"
              className={`hsm-status-tab ${
                visibilityFilter === "all" ? "active" : ""
              }`}
              onClick={() => setVisibilityFilter("all")}
            >
              <span>All</span>
              <span className="hsm-tab-count">{sections.length}</span>
            </button>
            <button
              type="button"
              className={`hsm-status-tab ${
                visibilityFilter === "visible" ? "active" : ""
              }`}
              onClick={() => setVisibilityFilter("visible")}
            >
              <span>Active</span>
              <span className="hsm-tab-count">{totalVisibleCount}</span>
            </button>
            <button
              type="button"
              className={`hsm-status-tab ${
                visibilityFilter === "hidden" ? "active" : ""
              }`}
              onClick={() => setVisibilityFilter("hidden")}
            >
              <span>Hidden</span>
              <span className="hsm-tab-count">{totalHiddenCount}</span>
            </button>
          </div>
        </div>

        <div className="hsm-type-tabs-bar">
          <div
            className="hsm-type-tabs"
            role="tablist"
            aria-label="Layout type filter"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filterType === "all"}
              className={`hsm-type-tab ${filterType === "all" ? "active" : ""}`}
              onClick={() => setFilterType("all")}
            >
              <span>All Layouts</span>
              <span className="hsm-type-tab-count">{sections.length}</span>
            </button>

            {sectionTypes.map((type) => {
              const countForType = sections.filter(
                (s) => s.type === type
              ).length;
              return (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={filterType === type}
                  className={`hsm-type-tab ${
                    filterType === type ? "active" : ""
                  }`}
                  onClick={() => setFilterType(type)}
                >
                  <span>{SECTION_TYPE_META[type]?.label || type}</span>
                  <span className="hsm-type-tab-count">{countForType}</span>
                </button>
              );
            })}
          </div>

          <span className="hsm-drag-hint">
            <GripVertical size={14} />
            <span>
              {reorderingSaving
                ? "Saving order..."
                : "Drag rows or use arrows to reorder"}
            </span>
          </span>
        </div>
      </div>

      {/* Structured Table-Aligned Sections List */}
      <div className="hsm-table-container">
        {filteredSections.length === 0 ? (
          <div className="hsm-empty-state">
            <div className="hsm-empty-card">
              <div className="hsm-empty-icon-box">
                <Search size={20} />
              </div>
              <h3 className="hsm-empty-title">
                {sections.length === 0
                  ? "No home sections created yet"
                  : "No sections match your filters"}
              </h3>
              <p className="hsm-empty-desc">
                {sections.length === 0
                  ? "Create your first home section to start curating content on the Cookeaze mobile app."
                  : `We couldn't find any ${
                      visibilityFilter === "visible"
                        ? "active "
                        : visibilityFilter === "hidden"
                          ? "hidden "
                          : ""
                    }sections${
                      filterType !== "all"
                        ? ` in "${
                            SECTION_TYPE_META[filterType]?.label || filterType
                          }"`
                        : ""
                    }${searchTerm ? ` matching "${searchTerm}"` : ""}.`}
              </p>
              <div className="hsm-empty-actions">
                {(filterType !== "all" ||
                  visibilityFilter !== "all" ||
                  searchTerm) && (
                  <button
                    type="button"
                    className="hsm-btn hsm-btn--primary"
                    onClick={() => {
                      setFilterType("all");
                      setVisibilityFilter("all");
                      setSearchTerm("");
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>Clear All Filters</span>
                  </button>
                )}
                {!showForm && (
                  <button
                    type="button"
                    className="hsm-btn"
                    onClick={() => {
                      setShowForm(true);
                      if (filterType !== "all") {
                        setNewSection((prev) => ({
                          ...prev,
                          type: filterType,
                          order: sections.length,
                        }));
                        setNewItem((prev) => ({
                          ...prev,
                          item_type: getDefaultItemTypeForSection(filterType),
                        }));
                      }
                    }}
                  >
                    <Plus size={14} />
                    <span>
                      {filterType !== "all"
                        ? `New ${
                            SECTION_TYPE_META[filterType]?.label || "Section"
                          }`
                        : "Create Section"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="hsm-table-head">
              <div>Order</div>
              <div>Section Name</div>
              <div>Layout Type</div>
              <div>Content Preview</div>
              <div>Visibility</div>
              <div style={{ textAlign: "right" }}>Actions</div>
            </div>

            {filteredSections.map((section) => {
              const isExpanded = expandedId === section.id;
              const isEditing = editingId === section.id;
              const isOpen = isExpanded || isEditing;
              const itemsList = section.items || [];
              const typeMeta = SECTION_TYPE_META[section.type] || {
                label: section.type,
                hint: "",
              };
              const globalIndex = sections.findIndex(
                (s) => s.id === section.id
              );
              const isDragged = draggedSectionId === section.id;
              const isDragOver = dragOverSectionId === section.id;

              const validThumbs = itemsList
                .map((it) => getItemDisplayImage(it.item, it.imageUrl))
                .filter(Boolean)
                .slice(0, 4);

              return (
                <div
                  key={section.id}
                  draggable={!isEditing && !reorderingSaving}
                  onDragStart={(e) => {
                    if (isEditing) {
                      e.preventDefault();
                      return;
                    }
                    setDraggedSectionId(section.id);
                  }}
                  onDragOver={(e) => {
                    if (!draggedSectionId || draggedSectionId === section.id)
                      return;
                    e.preventDefault();
                    if (dragOverSectionId !== section.id) {
                      setDragOverSectionId(section.id);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleSectionDrop(section.id);
                  }}
                  onDragEnd={() => {
                    setDraggedSectionId(null);
                    setDragOverSectionId(null);
                  }}
                  className={`hsm-section-item ${
                    isEditing ? "hsm-section-item--editing" : ""
                  } ${isDragged ? "hsm-section-item--dragging" : ""} ${
                    isDragOver ? "hsm-section-item--dragover" : ""
                  }`}
                >
                  {/* Fixed-Grid Section Row */}
                  <div
                    className="hsm-section-row"
                    onClick={() => {
                      if (isEditing) {
                        closeSectionDrawerOrEdit();
                      } else {
                        setExpandedId(isExpanded ? null : section.id);
                      }
                    }}
                  >
                    {/* Column 1: Grip + Order Number */}
                    <div
                      className="hsm-col-order"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="hsm-section-grip"
                        title="Drag to reorder section"
                      >
                        <GripVertical size={16} />
                      </div>
                      <span className="hsm-order-badge">{section.order}</span>
                    </div>

                    {/* Column 2: Section Name */}
                    <div className="hsm-col-title">
                      <h2 className="hsm-section-title">{section.title}</h2>
                    </div>

                    {/* Column 3: Layout Type */}
                    <div className="hsm-col-type">{typeMeta.label}</div>

                    {/* Column 4: Aligned Content Preview */}
                    <div className="hsm-col-preview">
                      <div className="hsm-thumb-group">
                        {validThumbs.map((thumb, i) => (
                          <img
                            key={i}
                            src={thumb}
                            alt=""
                            className="hsm-mini-thumb"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ))}
                      </div>
                      <span className="hsm-items-count-text">
                        {itemsList.length}{" "}
                        {itemsList.length === 1 ? "item" : "items"}
                      </span>
                    </div>

                    {/* Column 5: Human Toggle Switch for Visibility */}
                    <div
                      className="hsm-col-status"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        role="switch"
                        aria-checked={Boolean(section.is_active)}
                        onClick={() =>
                          toggleVisibility(section.id, section.is_active)
                        }
                        className="hsm-switch-label"
                        title={
                          section.is_active
                            ? "Click to hide section"
                            : "Click to make section active"
                        }
                      >
                        <span
                          className={`hsm-switch-track ${
                            section.is_active ? "hsm-switch-track--on" : ""
                          }`}
                        >
                          <span className="hsm-switch-thumb" />
                        </span>
                        <span
                          className={`hsm-switch-text ${
                            section.is_active ? "hsm-switch-text--on" : ""
                          }`}
                        >
                          {section.is_active ? "Active" : "Hidden"}
                        </span>
                      </button>
                    </div>

                    {/* Column 6: Actions */}
                    <div
                      className="hsm-col-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className="hsm-order-arrows"
                        title="Move section up or down"
                      >
                        <button
                          type="button"
                          className="hsm-order-arrow-btn"
                          disabled={globalIndex <= 0 || reorderingSaving}
                          onClick={() => moveSectionByOffset(section.id, -1)}
                          aria-label="Move section up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          className="hsm-order-arrow-btn"
                          disabled={
                            globalIndex === -1 ||
                            globalIndex >= sections.length - 1 ||
                            reorderingSaving
                          }
                          onClick={() => moveSectionByOffset(section.id, 1)}
                          aria-label="Move section down"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          isEditing
                            ? closeSectionDrawerOrEdit()
                            : startEditingSection(section)
                        }
                        className={`hsm-btn hsm-btn--sm ${
                          isEditing ? "hsm-btn--active-edit" : ""
                        }`}
                      >
                        {isEditing ? (
                          <>
                            <X size={13} />
                            <span>Close</span>
                          </>
                        ) : (
                          <>
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteSection(section.id)}
                        className="hsm-btn hsm-btn--icon hsm-btn--danger"
                        title="Delete section"
                      >
                        <Trash2 size={14} />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (isOpen) {
                            closeSectionDrawerOrEdit();
                          } else {
                            setExpandedId(section.id);
                          }
                        }}
                        className="hsm-btn hsm-btn--icon"
                        title={isOpen ? "Collapse section" : "Expand section"}
                        aria-label={
                          isOpen ? "Collapse section" : "Expand section"
                        }
                      >
                        {isOpen ? (
                          <ChevronUp size={15} />
                        ) : (
                          <ChevronDown size={15} />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Inline Edit Panel */}
                  {isEditing && (
                    <div className="hsm-section-drawer">
                      <div className="hsm-form-grid">
                        <div>
                          <label className="hsm-field-label">
                            Section Title
                          </label>
                          <input
                            type="text"
                            value={editFormData.title || ""}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                title: e.target.value,
                              })
                            }
                            className="hsm-input"
                          />
                        </div>

                        <div>
                          <label className="hsm-field-label">
                            Section Layout Type
                          </label>
                          <select
                            value={editFormData.type || ""}
                            onChange={(e) => {
                              const newType = e.target.value;
                              setEditFormData({
                                ...editFormData,
                                type: newType,
                              });
                              setEditItem((prev) => ({
                                ...prev,
                                item_type: getDefaultItemTypeForSection(newType),
                                item_id: "",
                              }));
                              setEditItemPreview(null);
                            }}
                            className="hsm-select"
                          >
                            {sectionTypes.map((type) => (
                              <option key={type} value={type}>
                                {SECTION_TYPE_META[type]?.label || type} ({type})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="hsm-field-label">
                            Display Order
                          </label>
                          <input
                            type="number"
                            value={editFormData.order ?? 0}
                            onChange={(e) =>
                              setEditFormData({
                                ...editFormData,
                                order: parseInt(e.target.value, 10) || 0,
                              })
                            }
                            className="hsm-input"
                          />
                        </div>
                      </div>

                      {/* Editable Items */}
                      <div className="hsm-items-box">
                        <div className="hsm-items-box-header">
                          <h3 className="hsm-items-box-title">
                            <span>
                              Section Items ({editFormData.items?.length || 0})
                            </span>
                            {(editFormData.items?.length || 0) > 1 && (
                              <span className="hsm-drag-hint">
                                • Drag cards to reorder
                              </span>
                            )}
                          </h3>
                          {!showEditItemForm && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowEditItemForm(true);
                                setEditingItemIndex(null);
                                setEditItem({
                                  item_type: getDefaultItemTypeForSection(
                                    editFormData.type
                                  ),
                                  item_id: "",
                                  card_color: "#FF5733",
                                  image_url: "",
                                  link_url: "",
                                });
                                setEditItemPreview(null);
                              }}
                              className="hsm-btn hsm-btn--sm hsm-btn--primary"
                            >
                              <Plus size={14} />
                              <span>Add Item</span>
                            </button>
                          )}
                        </div>

                        {showEditItemForm && (
                          <div
                            ref={editItemFormRef}
                            className="hsm-item-builder-card"
                          >
                            <div className="hsm-item-builder-header">
                              <h4 className="hsm-item-builder-title">
                                {editingItemIndex !== null
                                  ? `Editing Item #${editingItemIndex + 1}`
                                  : "Add New Item to Section"}
                              </h4>
                              <button
                                type="button"
                                className="hsm-btn hsm-btn--icon"
                                style={{ width: 28, height: 28 }}
                                onClick={() => {
                                  setShowEditItemForm(false);
                                  setEditingItemIndex(null);
                                  setEditItemPreview(null);
                                }}
                              >
                                <X size={14} />
                              </button>
                            </div>

                            <div className="hsm-item-builder-grid">
                              <div>
                                <label className="hsm-field-label">
                                  Content Type
                                </label>
                                <select
                                  value={editItem.item_type}
                                  onChange={(e) => {
                                    setEditItem({
                                      ...editItem,
                                      item_type: e.target.value,
                                      item_id: "",
                                    });
                                    setEditItemPreview(null);
                                  }}
                                  className="hsm-select"
                                  disabled={
                                    editFormData.type === "creator_spotlight" ||
                                    editFormData.type === "exclusive_recipes"
                                  }
                                >
                                  {editFormData.type === "creator_spotlight" ? (
                                    <option value="user">Creator (User)</option>
                                  ) : editFormData.type ===
                                    "exclusive_recipes" ? (
                                    <option value="recipe">
                                      Exclusive Recipe
                                    </option>
                                  ) : (
                                    <>
                                      <option value="recipe">Recipe</option>
                                      <option value="theme">Theme</option>
                                    </>
                                  )}
                                </select>
                              </div>

                              <div>
                                <label className="hsm-field-label">
                                  {isGraphicBanner(editFormData.type)
                                    ? "Linked Item (Optional)"
                                    : "Select Content"}
                                </label>
                                <button
                                  type="button"
                                  onClick={openEditSelectModal}
                                  className="hsm-btn w-100 justify-content-between"
                                >
                                  <span className="text-truncate">
                                    {editItem.item_id
                                      ? `${
                                          getItemDisplayName(editItemPreview) ||
                                          `ID #${editItem.item_id}`
                                        }`
                                      : `Choose ${editItem.item_type}...`}
                                  </span>
                                  <Search size={14} />
                                </button>
                              </div>

                              <div>
                                <label className="hsm-field-label">
                                  Card Accent Color
                                </label>
                                <div className="hsm-color-row">
                                  <input
                                    type="color"
                                    value={editItem.card_color}
                                    onChange={(e) =>
                                      setEditItem({
                                        ...editItem,
                                        card_color: e.target.value,
                                      })
                                    }
                                    className="hsm-color-input"
                                  />
                                  <span className="hsm-section-sub">
                                    {editItem.card_color.toUpperCase()}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {isGraphicBanner(editFormData.type) && (
                              <div className="hsm-item-builder-grid">
                                <div>
                                  <label className="hsm-field-label">
                                    Banner Artwork Upload
                                  </label>
                                  <div className="d-flex gap-2">
                                    <input
                                      type="file"
                                      accept="image/*,video/*"
                                      className="hsm-input"
                                      onChange={(e) =>
                                        setEditBannerFile(
                                          e.target.files?.[0] || null
                                        )
                                      }
                                    />
                                    <button
                                      type="button"
                                      className="hsm-btn"
                                      onClick={uploadEditBannerToCloudinary}
                                      disabled={
                                        uploadingEditBanner || !editBannerFile
                                      }
                                    >
                                      {uploadingEditBanner
                                        ? "Uploading..."
                                        : "Upload"}
                                    </button>
                                  </div>
                                  {editItem.image_url && (
                                    <div className="hsm-type-hint text-truncate">
                                      Uploaded: {editItem.image_url}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <label className="hsm-field-label">
                                    External Link URL{" "}
                                    {!editItem.item_id &&
                                      "(Required if no recipe linked)"}
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="https://..."
                                    value={editItem.link_url}
                                    onChange={(e) =>
                                      setEditItem({
                                        ...editItem,
                                        link_url: e.target.value,
                                      })
                                    }
                                    className="hsm-input"
                                  />
                                </div>
                              </div>
                            )}

                            {editItemPreview && (
                              <div className="hsm-selected-preview">
                                {getItemDisplayImage(editItemPreview) && (
                                  <img
                                    src={getItemDisplayImage(editItemPreview)}
                                    alt={getItemDisplayName(editItemPreview)}
                                    className="hsm-selected-thumb"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                  />
                                )}
                                <div>
                                  <div className="hsm-item-name">
                                    {getItemDisplayName(editItemPreview)}
                                  </div>
                                  {editItemPreview.id && (
                                    <div className="hsm-item-meta">
                                      ID #{editItemPreview.id}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                onClick={addItemToEditSection}
                                className="hsm-btn hsm-btn--sm hsm-btn--primary"
                                disabled={
                                  isGraphicBanner(editFormData.type)
                                    ? !editItem.image_url ||
                                      (!editItem.item_id && !editItem.link_url)
                                    : !editItem.item_id
                                }
                              >
                                <Save size={14} />
                                <span>
                                  {editingItemIndex !== null
                                    ? "Update Item"
                                    : "Confirm Item"}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setShowEditItemForm(false);
                                  setEditingItemIndex(null);
                                  setEditItemPreview(null);
                                }}
                                className="hsm-btn hsm-btn--sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}

                        {editFormData.items && editFormData.items.length > 0 ? (
                          <div className="hsm-items-grid">
                            {editFormData.items.map((item, idx) => {
                              let originalItem = null;
                              if (section.items && section.items.length > 0) {
                                const found = section.items.find((original) => {
                                  if (
                                    item.section_item_id &&
                                    original.sectionItemId
                                  ) {
                                    return (
                                      original.sectionItemId ===
                                      item.section_item_id
                                    );
                                  }
                                  if (item.item_id && original.item?.id) {
                                    return original.item.id === item.item_id;
                                  }
                                  return false;
                                });
                                if (found) originalItem = found.item;
                              }

                              const displayName =
                                item._previewName ||
                                getItemDisplayName(originalItem) ||
                                (item.item_id
                                  ? `${item.item_type} #${item.item_id}`
                                  : "Banner Item");

                              const displayImg =
                                item._previewImage ||
                                getItemDisplayImage(
                                  originalItem,
                                  item.image_url
                                );

                              const swatchColor = argbIntToHex(item.card_color);
                              const isDragged = draggedItemIdx === idx;
                              const isDragOver = dragOverItemIdx === idx;
                              const isCurrentlyEditingThisItem =
                                editingItemIndex === idx && showEditItemForm;

                              return (
                                <div
                                  key={`${
                                    item.section_item_id ??
                                    item.item_id ??
                                    "noid"
                                  }-${idx}`}
                                  draggable
                                  onDragStart={(e) => {
                                    e.stopPropagation();
                                    setDraggedItemIdx(idx);
                                  }}
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (dragOverItemIdx !== idx)
                                      setDragOverItemIdx(idx);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleEditItemDrop(idx);
                                  }}
                                  onDragEnd={(e) => {
                                    e.stopPropagation();
                                    setDraggedItemIdx(null);
                                    setDragOverItemIdx(null);
                                  }}
                                  className={`hsm-item-card hsm-item-card--draggable ${
                                    isDragged ? "hsm-item-card--dragging" : ""
                                  } ${
                                    isDragOver ? "hsm-item-card--dragover" : ""
                                  } ${
                                    isCurrentlyEditingThisItem
                                      ? "hsm-item-card--editing"
                                      : ""
                                  }`}
                                >
                                  <div className="hsm-item-card-left">
                                    <span
                                      className="hsm-drag-grip"
                                      title="Drag to reorder item"
                                    >
                                      <GripVertical size={15} />
                                    </span>
                                    {displayImg ? (
                                      <img
                                        src={displayImg}
                                        alt={displayName}
                                        className="hsm-item-thumb"
                                        onError={(e) => {
                                          e.target.style.display = "none";
                                        }}
                                      />
                                    ) : (
                                      <div className="hsm-item-thumb-placeholder">
                                        <ImageIcon size={17} />
                                      </div>
                                    )}
                                    <div className="hsm-item-info">
                                      <div
                                        className="hsm-item-name"
                                        title={displayName}
                                      >
                                        {displayName}
                                      </div>
                                      <div className="hsm-item-meta">
                                        <span>{item.item_type}</span>
                                        {item.item_id && (
                                          <span>• ID #{item.item_id}</span>
                                        )}
                                        <label
                                          className="hsm-inline-color-picker"
                                          title="Click to change this item's card color"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <input
                                            type="color"
                                            value={swatchColor || "#FF5733"}
                                            onChange={(e) => {
                                              const nextHex = e.target.value;
                                              const newColorInt =
                                                hexToArgbInt(nextHex);
                                              setEditFormData((prev) => {
                                                const updatedItems = [
                                                  ...(prev.items || []),
                                                ];
                                                if (updatedItems[idx]) {
                                                  updatedItems[idx] = {
                                                    ...updatedItems[idx],
                                                    card_color: newColorInt,
                                                  };
                                                }
                                                return {
                                                  ...prev,
                                                  items: updatedItems,
                                                };
                                              });
                                              if (editingItemIndex === idx) {
                                                setEditItem((prev) => ({
                                                  ...prev,
                                                  card_color: nextHex,
                                                }));
                                              }
                                            }}
                                            className="hsm-inline-color-input"
                                          />
                                          <span
                                            className="hsm-swatch hsm-swatch--interactive"
                                            style={{
                                              backgroundColor:
                                                swatchColor || "#cbd5e1",
                                            }}
                                          />
                                          <span className="hsm-inline-color-hex">
                                            {swatchColor
                                              ? swatchColor.toUpperCase()
                                              : "Color"}
                                          </span>
                                        </label>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="d-flex gap-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingItemIndex(idx);
                                        setEditItem({
                                          item_type:
                                            editFormData.type ===
                                            "creator_spotlight"
                                              ? "user"
                                              : item.item_type || "recipe",
                                          item_id:
                                            item.item_id?.toString() || "",
                                          card_color: swatchColor || "#FF5733",
                                          image_url: item.image_url || "",
                                          link_url: item.link_url || "",
                                        });
                                        setEditItemPreview(
                                          originalItem || null
                                        );
                                        setShowEditItemForm(true);
                                        setTimeout(() => {
                                          editItemFormRef.current?.scrollIntoView(
                                            {
                                              behavior: "smooth",
                                              block: "nearest",
                                            }
                                          );
                                        }, 50);
                                      }}
                                      className="hsm-btn hsm-btn--icon"
                                      title="Edit item"
                                    >
                                      <Edit2 size={13} />
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeItemFromEditSection(idx)
                                      }
                                      className="hsm-btn hsm-btn--icon hsm-btn--danger"
                                      title="Remove item"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="hsm-section-sub">
                            No items in this section.
                          </div>
                        )}
                      </div>

                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          onClick={() => updateSection(section.id)}
                          className="hsm-btn hsm-btn--primary"
                          disabled={loading}
                        >
                          <Save size={15} />
                          <span>{loading ? "Saving..." : "Save Changes"}</span>
                        </button>

                        <button
                          type="button"
                          onClick={closeSectionDrawerOrEdit}
                          className="hsm-btn"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded Read-Only Items Drawer */}
                  {isExpanded && !isEditing && (
                    <div className="hsm-section-drawer">
                      <div className="hsm-drawer-top">
                        <h3 className="hsm-drawer-title">
                          Curated Items ({itemsList.length})
                        </h3>
                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="hsm-btn hsm-btn--sm"
                            onClick={() => startEditingSection(section)}
                          >
                            <Edit2 size={13} />
                            <span>Edit Section & Items</span>
                          </button>
                          <button
                            type="button"
                            className="hsm-btn hsm-btn--sm"
                            onClick={() => setExpandedId(null)}
                          >
                            <X size={13} />
                            <span>Close</span>
                          </button>
                        </div>
                      </div>

                      {itemsList.length === 0 ? (
                        <div className="hsm-section-sub">
                          No items configured in this section.
                        </div>
                      ) : (
                        <div className="hsm-items-grid">
                          {itemsList.map((item, idx) => {
                            const rawColor = extractItemColorRaw(item);
                            const swatchColor = argbIntToHex(rawColor);
                            const name =
                              getItemDisplayName(item.item) ||
                              `Item #${item.sectionItemId}`;
                            const thumb = getItemDisplayImage(
                              item.item,
                              item.imageUrl
                            );
                            const linkTarget = item.linkUrl || item.link_url;

                            return (
                              <div
                                key={`${item.sectionItemId ?? "sid"}-${idx}`}
                                className="hsm-item-card"
                              >
                                <div className="hsm-item-card-left">
                                  {thumb ? (
                                    <img
                                      src={thumb}
                                      alt={name}
                                      className="hsm-item-thumb"
                                      onError={(e) => {
                                        e.target.style.display = "none";
                                      }}
                                    />
                                  ) : (
                                    <div className="hsm-item-thumb-placeholder">
                                      <ImageIcon size={17} />
                                    </div>
                                  )}
                                  <div className="hsm-item-info">
                                    <div className="hsm-item-name" title={name}>
                                      {name}
                                    </div>
                                    <div className="hsm-item-meta">
                                      {item.item?.id && (
                                        <span>ID #{item.item.id}</span>
                                      )}
                                      {item.item?.total_recipes !==
                                        undefined && (
                                        <span>
                                          • {item.item.total_recipes} recipes
                                        </span>
                                      )}
                                      {swatchColor && (
                                        <span
                                          className="hsm-swatch"
                                          style={{
                                            backgroundColor: swatchColor,
                                          }}
                                          title={`Color: ${swatchColor}`}
                                        />
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {linkTarget && (
                                  <a
                                    href={linkTarget}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="hsm-btn hsm-btn--icon"
                                    title={linkTarget}
                                  >
                                    <ExternalLink size={14} />
                                  </a>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* Item Picker Modal (Create Mode) */}
      {showSelectModal && (
        <div
          className="hsm-modal-backdrop"
          onClick={() => setShowSelectModal(false)}
        >
          <div className="hsm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hsm-modal-header">
              <h3 className="hsm-modal-title">
                Select{" "}
                {newItem.item_type === "user"
                  ? "Creator"
                  : newItem.item_type === "theme"
                    ? "Theme"
                    : "Recipe"}
              </h3>
              <button
                type="button"
                className="hsm-btn hsm-btn--icon"
                onClick={() => setShowSelectModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="hsm-modal-body">
              {(newItem.item_type === "recipe" ||
                newItem.item_type === "user") && (
                <div className="d-flex gap-2 mb-3">
                  <input
                    type="search"
                    placeholder={`Search ${
                      newItem.item_type === "user" ? "creators" : "recipes"
                    } by name...`}
                    value={recipesSearchInput}
                    onChange={(e) => setRecipesSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleRecipesSearch();
                    }}
                    className="hsm-input"
                  />
                  <button
                    type="button"
                    onClick={handleRecipesSearch}
                    className="hsm-btn hsm-btn--primary"
                  >
                    <Search size={15} />
                    <span>Search</span>
                  </button>
                </div>
              )}

              {loadingItems ? (
                <div className="hsm-picker-grid">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="hsm-picker-item">
                      <div
                        className="shimmer"
                        style={{ width: 48, height: 48, borderRadius: 6 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          className="shimmer"
                          style={{ width: "75%", height: 14, marginBottom: 8 }}
                        />
                        <div
                          className="shimmer"
                          style={{ width: "40%", height: 12 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : availableItems.length === 0 ? (
                <div className="hsm-empty-state">No matching items found.</div>
              ) : (
                <div className="hsm-picker-grid">
                  {availableItems.map((item) => {
                    const img = getItemDisplayImage(item);
                    const title = getItemDisplayName(item);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className="hsm-picker-item"
                        onClick={() => selectItemFromModal(item)}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={title}
                            className="hsm-picker-thumb"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="hsm-item-thumb-placeholder">
                            <ImageIcon size={17} />
                          </div>
                        )}
                        <div className="hsm-item-info">
                          <div className="hsm-item-name">{title}</div>
                          <div className="hsm-item-meta">
                            <span>ID #{item.id}</span>
                            {item.total_recipes !== undefined && (
                              <span>• {item.total_recipes} recipes</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hsm-modal-footer">
              {(newItem.item_type === "recipe" ||
                newItem.item_type === "user") &&
              recipesTotalPages > 1 ? (
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setRecipesPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={recipesPage === 1}
                    className="hsm-btn hsm-btn--sm"
                  >
                    <ChevronLeft size={15} />
                    <span>Prev</span>
                  </button>
                  <span className="hsm-section-sub">
                    Page {recipesPage} of {recipesTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setRecipesPage((prev) =>
                        Math.min(recipesTotalPages, prev + 1)
                      )
                    }
                    disabled={recipesPage === recipesTotalPages}
                    className="hsm-btn hsm-btn--sm"
                  >
                    <span>Next</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                className="hsm-btn"
                onClick={() => setShowSelectModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Picker Modal (Edit Mode) */}
      {showEditSelectModal && (
        <div
          className="hsm-modal-backdrop"
          onClick={() => setShowEditSelectModal(false)}
        >
          <div className="hsm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="hsm-modal-header">
              <h3 className="hsm-modal-title">
                Select{" "}
                {editItem.item_type === "user"
                  ? "Creator"
                  : editItem.item_type === "theme"
                    ? "Theme"
                    : "Recipe"}
              </h3>
              <button
                type="button"
                className="hsm-btn hsm-btn--icon"
                onClick={() => setShowEditSelectModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="hsm-modal-body">
              {(editItem.item_type === "recipe" ||
                editItem.item_type === "user") && (
                <div className="d-flex gap-2 mb-3">
                  <input
                    type="search"
                    placeholder={`Search ${
                      editItem.item_type === "user" ? "creators" : "recipes"
                    } by name...`}
                    value={editRecipesSearchInput}
                    onChange={(e) => setEditRecipesSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleEditRecipesSearch();
                    }}
                    className="hsm-input"
                  />
                  <button
                    type="button"
                    onClick={handleEditRecipesSearch}
                    className="hsm-btn hsm-btn--primary"
                  >
                    <Search size={15} />
                    <span>Search</span>
                  </button>
                </div>
              )}

              {loadingEditItems ? (
                <div className="hsm-picker-grid">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <div key={n} className="hsm-picker-item">
                      <div
                        className="shimmer"
                        style={{ width: 48, height: 48, borderRadius: 6 }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          className="shimmer"
                          style={{ width: "75%", height: 14, marginBottom: 8 }}
                        />
                        <div
                          className="shimmer"
                          style={{ width: "40%", height: 12 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : editAvailableItems.length === 0 ? (
                <div className="hsm-empty-state">No matching items found.</div>
              ) : (
                <div className="hsm-picker-grid">
                  {editAvailableItems.map((item) => {
                    const img = getItemDisplayImage(item);
                    const title = getItemDisplayName(item);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className="hsm-picker-item"
                        onClick={() => selectEditItemFromModal(item)}
                      >
                        {img ? (
                          <img
                            src={img}
                            alt={title}
                            className="hsm-picker-thumb"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <div className="hsm-item-thumb-placeholder">
                            <ImageIcon size={17} />
                          </div>
                        )}
                        <div className="hsm-item-info">
                          <div className="hsm-item-name">{title}</div>
                          <div className="hsm-item-meta">
                            <span>ID #{item.id}</span>
                            {item.total_recipes !== undefined && (
                              <span>• {item.total_recipes} recipes</span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="hsm-modal-footer">
              {(editItem.item_type === "recipe" ||
                editItem.item_type === "user") &&
              editRecipesTotalPages > 1 ? (
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditRecipesPage((prev) => Math.max(1, prev - 1))
                    }
                    disabled={editRecipesPage === 1}
                    className="hsm-btn hsm-btn--sm"
                  >
                    <ChevronLeft size={15} />
                    <span>Prev</span>
                  </button>
                  <span className="hsm-section-sub">
                    Page {editRecipesPage} of {editRecipesTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setEditRecipesPage((prev) =>
                        Math.min(editRecipesTotalPages, prev + 1)
                      )
                    }
                    disabled={editRecipesPage === editRecipesTotalPages}
                    className="hsm-btn hsm-btn--sm"
                  >
                    <span>Next</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                type="button"
                className="hsm-btn"
                onClick={() => setShowEditSelectModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirm && (
        <div className="hsm-modal-backdrop" onClick={cancelDelete}>
          <div
            className="hsm-modal hsm-modal--sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hsm-modal-header">
              <h3 className="hsm-modal-title">Delete Home Section</h3>
              <button
                type="button"
                className="hsm-btn hsm-btn--icon"
                onClick={cancelDelete}
              >
                <X size={16} />
              </button>
            </div>
            <div className="hsm-modal-body">
              <p className="mb-0" style={{ fontSize: 14, color: "#475569" }}>
                Are you sure you want to permanently delete this section from
                the home screen? This action cannot be undone.
              </p>
            </div>
            <div className="hsm-modal-footer justify-content-end">
              <button
                type="button"
                onClick={cancelDelete}
                disabled={loading}
                className="hsm-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={loading}
                className="hsm-btn hsm-btn--danger-solid"
              >
                {loading ? "Deleting..." : "Delete Section"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeSectionAdmin;
