// src/pages/MarketCatalogPage.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Package,
  Boxes,
  Layers,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Upload,
  Sliders,
  Image as ImageIcon,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import CloudinaryService from "../components/cloudinaryService";
import "./MarketCatalogPage.css";

const BASE_UNIT_PRESETS = ["kg", "g", "L", "pcs", "bag", "jar", "basket", "pack"];

function inferBaseQuantityFromSize(sizeStr) {
  if (!sizeStr || typeof sizeStr !== "string") return 1;
  const match = sizeStr.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return 1;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function extractArray(payload, keys = []) {
  const root = payload?.data !== undefined ? payload.data : payload;
  if (!root) return [];
  if (Array.isArray(root)) return root;

  for (const k of keys) {
    if (Array.isArray(root[k])) return root[k];
    if (root.data && Array.isArray(root.data[k])) return root.data[k];
  }

  const fallbacks = [
    "items",
    "catalog",
    "meal_packs",
    "categories",
    "variants",
    "ingredients",
    "results",
    "data",
  ];
  for (const k of fallbacks) {
    if (Array.isArray(root[k])) return root[k];
    if (root.data && Array.isArray(root.data[k])) return root.data[k];
  }
  return [];
}

function extractObject(payload) {
  const root = payload?.data !== undefined ? payload.data : payload;
  if (!root || typeof root !== "object") return null;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data;
  }
  return root;
}

function parseArrayField(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function formatNaira(val) {
  const num = Number(val);
  if (val === null || val === undefined || val === "" || Number.isNaN(num)) {
    return "—";
  }
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSourceLabel(raw) {
  if (!raw || typeof raw !== "string") return "";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function extractApiError(err, fallbackMsg) {
  const data = err?.response?.data;
  if (!data) return fallbackMsg;
  if (typeof data === "string") return data;
  if (data.message) return data.message;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  if (typeof data === "object") {
    const firstKey = Object.keys(data)[0];
    if (firstKey) {
      const val = data[firstKey];
      return `${firstKey}: ${Array.isArray(val) ? val.join(", ") : JSON.stringify(val)}`;
    }
  }
  return fallbackMsg;
}

function normalizeVariant(v) {
  if (!v || typeof v !== "object") return null;
  const sizeStr = String(v.size || v.label || "").trim();
  const inferredQty = inferBaseQuantityFromSize(sizeStr);
  return {
    id: v.id ?? v.variant_id ?? null,
    size: sizeStr,
    unit_label: String(v.unit_label || v.unit || sizeStr || "kg").trim(),
    quantity_in_base_unit:
      v.quantity_in_base_unit !== undefined && v.quantity_in_base_unit !== null
        ? Number(v.quantity_in_base_unit)
        : inferredQty,
    price: v.price ?? v.unit_price ?? "0.00",
    in_stock: v.in_stock !== false,
    is_active: v.is_active !== false,
    sort_order: v.sort_order ?? 0,
  };
}

function normalizeCatalogItem(item, categoriesMap, categoriesByNameMap, cachedDetail) {
  if (!item || typeof item !== "object") return null;
  const merged = cachedDetail ? { ...item, ...cachedDetail } : item;

  const catObj =
    typeof merged.category === "object" && merged.category !== null
      ? merged.category
      : null;

  const rawCatStr =
    typeof merged.category === "string" ? merged.category.trim() : "";

  const matchedCatByName = rawCatStr
    ? categoriesByNameMap?.get(rawCatStr.toLowerCase())
    : null;

  const itemNameLower = String(merged.name || item.name || "")
    .trim()
    .toLowerCase();

  let fallbackProduceCat = null;
  if (
    itemNameLower.includes("tomato") &&
    !itemNameLower.includes("paste") &&
    categoriesMap
  ) {
    for (const c of categoriesMap.values()) {
      const cn = c.name.toLowerCase();
      if (
        cn.includes("produce") ||
        cn.includes("vegetable") ||
        cn.includes("fresh tomato")
      ) {
        fallbackProduceCat = c;
        break;
      }
    }
  }

  const categoryId =
    merged.category_id ??
    catObj?.id ??
    (typeof merged.category === "number" ? merged.category : null) ??
    matchedCatByName?.id ??
    fallbackProduceCat?.id ??
    null;

  const categoryName =
    (categoryId && categoriesMap.get(Number(categoryId))?.name) ||
    rawCatStr ||
    catObj?.name ||
    merged.category_name ||
    fallbackProduceCat?.name ||
    (itemNameLower.includes("tomato") && !itemNameLower.includes("paste")
      ? "Fresh Produce & Vegetables"
      : "Uncategorized");

  const rawVariants = parseArrayField(merged.variants ?? item.variants);
  const variants = rawVariants
    .map(normalizeVariant)
    .filter((v) => v && v.is_active !== false);

  const availableQty = Number(
    merged.available_quantity ??
      merged.quantity ??
      merged.quantity_in_stock ??
      item.available_quantity ??
      item.quantity ??
      0
  );

  const isInStock =
    merged.in_stock !== undefined
      ? Boolean(merged.in_stock)
      : merged.is_in_stock !== undefined
      ? Boolean(merged.is_in_stock)
      : merged.stock_status !== "out_of_stock";

  return {
    id: item.id,
    name: String(merged.name || `Item #${item.id}`).trim(),
    category_id: categoryId ? Number(categoryId) : null,
    category_name: categoryName,
    emoji: merged.emoji || "🥬",
    image_url: merged.image_url || "",
    description: merged.description || "",
    base_unit: merged.base_unit || variants[0]?.unit_label || "kg",
    search_keywords: merged.search_keywords || "",
    is_active: merged.is_active !== false,
    in_stock: isInStock,
    available_quantity: Number.isNaN(availableQty) ? 0 : availableQty,
    stock_status:
      merged.stock_status || (isInStock ? "in_stock" : "out_of_stock"),
    variants,
  };
}

function normalizeCategory(cat) {
  if (!cat || typeof cat !== "object") return null;
  return {
    id: cat.id,
    name: String(cat.name || `Category #${cat.id}`).trim(),
    emoji: cat.emoji || "🧺",
    icon_url: cat.icon_url || "",
    sort_order: cat.sort_order ?? 0,
    is_active: cat.is_active !== false,
  };
}

function normalizeMealPack(mp) {
  if (!mp || typeof mp !== "object") return null;
  const rawIngredients = parseArrayField(mp.ingredients ?? mp.items);

  const ingredientCount = Number(
    mp.ingredient_count ?? mp.items_count ?? rawIngredients.length ?? 0
  );

  const estPrice =
    mp.estimated_price ?? mp.estimated_cost ?? mp.price ?? mp.total_price ?? null;

  const availableQty = Number(
    mp.available_quantity ?? mp.quantity_on_hand ?? 0
  );

  return {
    id: mp.id,
    name: String(mp.name || `Meal Pack #${mp.id}`).trim(),
    description: mp.description || "",
    image_url: mp.image_url || "",
    is_active: mp.is_active !== false,
    sort_order: mp.sort_order ?? 0,
    ingredient_count: Number.isNaN(ingredientCount) ? 0 : ingredientCount,
    estimated_price: estPrice,
    stock_status: mp.stock_status || "in_stock",
    available_quantity: Number.isNaN(availableQty) ? 0 : availableQty,
    availability_source: mp.availability_source || "",
    ingredients: rawIngredients,
  };
}

/**
 * Resolves a meal pack ingredient object (from `GET /api/market/meal-packs/{id}/`)
 * to `{ catalog_item_id, variant_id, suggested_quantity, sort_order }` using
 * the loaded `catalogItems` list.
 */
function resolveMealPackIngredientToFormRow(ing, idx, catalogItems) {
  if (!ing || typeof ing !== "object") return null;

  const explicitCatId =
    ing.catalog_item_id ?? ing.ingredient_id ?? ing.catalog_item?.id ?? null;
  const ingNameLower = String(ing.name || ing.ingredient_name || "")
    .trim()
    .toLowerCase();

  let matchedCatalog = null;

  // 1. Try explicit catalog_item_id first
  if (explicitCatId !== null && explicitCatId !== undefined) {
    matchedCatalog = catalogItems.find(
      (c) => Number(c.id) === Number(explicitCatId)
    );
  }

  // 2. Try matching by exact ingredient name (most reliable when `MealPackDetail` returns `{ id, name, size, price }`)
  if (!matchedCatalog && ingNameLower) {
    matchedCatalog = catalogItems.find(
      (c) => c.name.trim().toLowerCase() === ingNameLower
    );
  }

  // 3. Fallback to `ing.id` only if no name was provided or name matches
  if (!matchedCatalog && ing.id !== undefined) {
    const candidate = catalogItems.find((c) => Number(c.id) === Number(ing.id));
    if (
      candidate &&
      (!ingNameLower || candidate.name.trim().toLowerCase() === ingNameLower)
    ) {
      matchedCatalog = candidate;
    }
  }

  if (!matchedCatalog) return null;

  const variants = Array.isArray(matchedCatalog.variants)
    ? matchedCatalog.variants
    : [];

  // Now match the exact variant (`variant_id`, `size`, or `price`)
  const explicitVarId = ing.variant_id ?? ing.variant?.id ?? null;
  const rawSize = String(ing.size || ing.variant_size || "").trim().toLowerCase();
  const rawPrice = Number(ing.price ?? ing.unit_price ?? NaN);

  let matchedVariant = null;

  if (explicitVarId !== null && explicitVarId !== undefined) {
    matchedVariant = variants.find(
      (v) => Number(v.id) === Number(explicitVarId)
    );
  }

  if (!matchedVariant && rawSize) {
    matchedVariant = variants.find(
      (v) => v.size.trim().toLowerCase() === rawSize
    );
  }

  if (!matchedVariant && !Number.isNaN(rawPrice) && rawPrice > 0) {
    matchedVariant = variants.find((v) => Number(v.price) === rawPrice);
  }

  if (!matchedVariant && variants.length > 0) {
    matchedVariant = variants[0];
  }

  return {
    catalog_item_id: String(matchedCatalog.id),
    variant_id: matchedVariant?.id ? String(matchedVariant.id) : "",
    suggested_quantity: String(
      Math.max(1, Number(ing.suggested_quantity ?? ing.quantity ?? 1) || 1)
    ),
    sort_order: idx,
  };
}

export default function MarketCatalogPage({ defaultTab = "catalog" }) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  useEffect(() => {
    if (defaultTab) setActiveTab(defaultTab);
  }, [defaultTab]);

  // Core Data States
  const [catalogRaw, setCatalogRaw] = useState([]);
  const [categoriesRaw, setCategoriesRaw] = useState([]);
  const [mealPacksRaw, setMealPacksRaw] = useState([]);
  const [itemDetailsMap, setItemDetailsMap] = useState({});

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Filters & Search
  const [stockFilter, setStockFilter] = useState("all"); // all | in_stock | out_of_stock
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // ── 1. Create / Edit Catalog Item Modal (`POST/PATCH /api/ingredients/catalog/` + Variants) ──
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemFormName, setItemFormName] = useState("");
  const [itemFormCategoryId, setItemFormCategoryId] = useState("");
  const [itemFormBaseUnit, setItemFormBaseUnit] = useState("kg");
  const [itemFormEmoji, setItemFormEmoji] = useState("🥬");
  const [itemFormImageUrl, setItemFormImageUrl] = useState("");
  const [itemImageBroken, setItemImageBroken] = useState(false);
  const [itemFormDescription, setItemFormDescription] = useState("");
  const [itemFormKeywords, setItemFormKeywords] = useState("");
  const [itemFormIsActive, setItemFormIsActive] = useState(true);
  const [itemFormVariants, setItemFormVariants] = useState([]);
  const [removedVariantIds, setRemovedVariantIds] = useState([]);
  const [uploadingItemImage, setUploadingItemImage] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const userTouchedItemFormRef = useRef(false);

  // Inline Quick-Create Category inside Ingredient Modal
  const [inlineCatOpen, setInlineCatOpen] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");
  const [inlineCatEmoji, setInlineCatEmoji] = useState("🍅");
  const [creatingInlineCat, setCreatingInlineCat] = useState(false);

  // ── 2. Dedicated Manage Variants Modal (`POST .../variants/` & `PATCH .../variants/{variant_id}/`) ──
  const [variantsModalItem, setVariantsModalItem] = useState(null);
  const [variantsList, setVariantsList] = useState([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [editingVariantId, setEditingVariantId] = useState(null);
  const [varFormSize, setVarFormSize] = useState("");
  const [varFormUnitLabel, setVarFormUnitLabel] = useState("");
  const [varFormQtyBase, setVarFormQtyBase] = useState("1");
  const [varFormPrice, setVarFormPrice] = useState("");
  const [varFormInStock, setVarFormInStock] = useState(true);
  const [varFormIsActive, setVarFormIsActive] = useState(true);
  const [varFormSortOrder, setVarFormSortOrder] = useState("0");
  const [savingVariant, setSavingVariant] = useState(false);

  // ── 3. Create / Edit Category Modal (`POST/PATCH /api/ingredients/categories/`) ──
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catFormName, setCatFormName] = useState("");
  const [catFormEmoji, setCatFormEmoji] = useState("🧺");
  const [catFormIconUrl, setCatFormIconUrl] = useState("");
  const [catFormSortOrder, setCatFormSortOrder] = useState("0");
  const [catFormIsActive, setCatFormIsActive] = useState(true);
  const [savingCat, setSavingCat] = useState(false);

  // ── 4. Create / Edit Meal Pack Modal (`POST/PATCH /api/market/meal-packs/`) ──
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [editingPack, setEditingPack] = useState(null);
  const [packFormName, setPackFormName] = useState("");
  const [packFormDescription, setPackFormDescription] = useState("");
  const [packFormImageUrl, setPackFormImageUrl] = useState("");
  const [packImageBroken, setPackImageBroken] = useState(false);
  const [packFormIsActive, setPackFormIsActive] = useState(true);
  const [packFormSortOrder, setPackFormSortOrder] = useState("0");
  const [packFormItems, setPackFormItems] = useState([]);
  const [packPickerOpen, setPackPickerOpen] = useState(false);
  const [packPickerSearch, setPackPickerSearch] = useState("");
  const [packPickerCategory, setPackPickerCategory] = useState("all");
  const [pickerTargetRowIndex, setPickerTargetRowIndex] = useState(null);
  const [uploadingPackImage, setUploadingPackImage] = useState(false);
  const [savingPack, setSavingPack] = useState(false);
  const [loadingPackDetailForEdit, setLoadingPackDetailForEdit] = useState(false);
  const packItemsScrollRef = useRef(null);

  // ── 5. Meal Pack Detail Inspection Modal (`GET /api/market/meal-packs/{id}/`) ──
  const [inspectPack, setInspectPack] = useState(null);
  const [loadingInspectPack, setLoadingInspectPack] = useState(false);

  // ── 6. Delete Confirmation Modal ──
  const [deleteDialog, setDeleteDialog] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // One-time auto-provisioning ref for Fresh Farm Tomatoes category
  const autoProvisionedTomatoesRef = useRef(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  // Fetch All Market Data
  const fetchMarketData = useCallback(
    async (isSilent = false) => {
      if (isSilent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const api = getAxiosInstance();
      try {
        const [catRes, catalogRes, packsRes] = await Promise.allSettled([
          api.get("/ingredients/categories/"),
          api.get("/ingredients/catalog/?page_size=200"),
          api.get("/market/meal-packs/?page_size=200"),
        ]);

        if (catRes.status === "fulfilled") {
          setCategoriesRaw(
            extractArray(catRes.value, ["categories", "results", "data"])
          );
        }
        if (catalogRes.status === "fulfilled") {
          const loadedCatalog = extractArray(catalogRes.value, [
            "items",
            "catalog",
            "results",
            "data",
          ]);
          setCatalogRaw(loadedCatalog);

          // Hydrate full item detail (`description`, etc.) in background for items missing it
          Promise.allSettled(
            loadedCatalog.slice(0, 30).map((it) =>
              api.get(`/ingredients/catalog/${it.id}/`).then((r) => ({
                id: it.id,
                detail: extractObject(r),
              }))
            )
          ).then((results) => {
            const updates = {};
            results.forEach((resItem) => {
              if (resItem.status === "fulfilled" && resItem.value?.detail) {
                const d = resItem.value.detail;
                updates[resItem.value.id] = {
                  ...(d.description !== undefined
                    ? { description: d.description || "" }
                    : {}),
                  ...(d.base_unit ? { base_unit: d.base_unit } : {}),
                  ...(d.search_keywords !== undefined
                    ? { search_keywords: d.search_keywords || "" }
                    : {}),
                  ...(d.category_id ? { category_id: d.category_id } : {}),
                  ...(typeof d.category === "string" && d.category
                    ? { category: d.category }
                    : {}),
                  ...(Array.isArray(d.variants) && d.variants.length > 0
                    ? { variants: d.variants }
                    : {}),
                };
              }
            });
            if (Object.keys(updates).length > 0) {
              setItemDetailsMap((prev) => {
                const next = { ...prev };
                Object.entries(updates).forEach(([k, val]) => {
                  next[k] = { ...(next[k] || {}), ...val };
                });
                return next;
              });
            }
          });
        }
        if (packsRes.status === "fulfilled") {
          setMealPacksRaw(
            extractArray(packsRes.value, [
              "meal_packs",
              "items",
              "results",
              "data",
            ])
          );
        }
      } catch (err) {
        showToast(
          "error",
          extractApiError(err, "Failed to load market catalog data.")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchMarketData(false);
  }, [fetchMarketData]);

  // Normalized Collections
  const categories = useMemo(
    () => categoriesRaw.map(normalizeCategory).filter(Boolean),
    [categoriesRaw]
  );

  const categoriesMap = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(Number(c.id), c));
    return m;
  }, [categories]);

  const categoriesByNameMap = useMemo(() => {
    const m = new Map();
    categories.forEach((c) => m.set(c.name.trim().toLowerCase(), c));
    return m;
  }, [categories]);

  const catalogItems = useMemo(
    () =>
      catalogRaw
        .map((item) =>
          normalizeCatalogItem(
            item,
            categoriesMap,
            categoriesByNameMap,
            itemDetailsMap[item.id]
          )
        )
        .filter(Boolean),
    [catalogRaw, categoriesMap, categoriesByNameMap, itemDetailsMap]
  );

  const mealPacks = useMemo(
    () => mealPacksRaw.map(normalizeMealPack).filter(Boolean),
    [mealPacksRaw]
  );

  // Automatically create "Fresh Produce & Vegetables" category and assign it to "Fresh Farm Tomatoes" if uncategorized
  useEffect(() => {
    if (loading || autoProvisionedTomatoesRef.current) return;
    if (catalogItems.length === 0) return;

    const freshTomatoItem = catalogItems.find(
      (it) =>
        it.name.toLowerCase().includes("fresh") &&
        it.name.toLowerCase().includes("tomato")
    );
    if (!freshTomatoItem) return;

    const isTomatoUncategorized =
      !freshTomatoItem.category_id &&
      (freshTomatoItem.category_name === "Uncategorized" ||
        !freshTomatoItem.category_name);

    const existingProduceCat = categories.find((c) => {
      const n = c.name.toLowerCase();
      return (
        n.includes("produce") ||
        n.includes("vegetable") ||
        n.includes("fresh tomato") ||
        n.includes("fruits")
      );
    });

    if (!isTomatoUncategorized && existingProduceCat) {
      autoProvisionedTomatoesRef.current = true;
      return;
    }

    autoProvisionedTomatoesRef.current = true;

    (async () => {
      const api = getAxiosInstance();
      try {
        let targetCat = existingProduceCat;
        if (!targetCat) {
          const createCatRes = await api.post("/ingredients/categories/", {
            name: "Fresh Produce & Vegetables",
            emoji: "🍅",
            sort_order: 1,
            is_active: true,
          });
          const createdObj = extractObject(createCatRes);
          if (createdObj && createdObj.id) {
            targetCat = normalizeCategory(createdObj);
          } else {
            const refreshedCats = await api.get("/ingredients/categories/");
            const allCats = extractArray(refreshedCats, [
              "categories",
              "results",
              "data",
            ])
              .map(normalizeCategory)
              .filter(Boolean);
            targetCat = allCats.find((c) =>
              c.name.toLowerCase().includes("produce")
            );
          }
        }

        if (targetCat && isTomatoUncategorized) {
          await api.patch(`/ingredients/catalog/${freshTomatoItem.id}/`, {
            name: freshTomatoItem.name,
            base_unit: freshTomatoItem.base_unit || "basket",
            category_id: Number(targetCat.id),
          });
          setItemDetailsMap((prev) => ({
            ...prev,
            [freshTomatoItem.id]: {
              ...(prev[freshTomatoItem.id] || {}),
              category_id: Number(targetCat.id),
              category: targetCat.name,
              category_name: targetCat.name,
            },
          }));
        }

        await fetchMarketData(true);
      } catch {
        // If unauthenticated or read-only session, fail silently
      }
    })();
  }, [loading, catalogItems, categories, fetchMarketData]);

  // Summary Stats
  const summaryStats = useMemo(() => {
    let inStockItems = 0;
    let totalVariants = 0;

    catalogItems.forEach((item) => {
      if (item.in_stock) inStockItems += 1;
      totalVariants += item.variants.length;
    });

    const availablePacks = mealPacks.filter(
      (mp) => mp.stock_status !== "out_of_stock"
    ).length;

    return {
      totalItems: catalogItems.length,
      inStockItems,
      outOfStockItems: Math.max(0, catalogItems.length - inStockItems),
      totalVariants,
      totalCategories: categories.length,
      totalMealPacks: mealPacks.length,
      availablePacks,
    };
  }, [catalogItems, categories, mealPacks]);

  // Filtered Lists per Tab
  const filteredCatalogItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return catalogItems.filter((item) => {
      if (stockFilter === "in_stock" && !item.in_stock) return false;
      if (stockFilter === "out_of_stock" && item.in_stock) return false;

      if (selectedCategoryFilter !== "all") {
        const matchById =
          item.category_id &&
          String(item.category_id) === String(selectedCategoryFilter);
        const matchByName =
          item.category_name.toLowerCase() ===
          String(selectedCategoryFilter).toLowerCase();
        if (!matchById && !matchByName) return false;
      }

      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.category_name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.search_keywords.toLowerCase().includes(q) ||
        String(item.id).includes(q)
      );
    });
  }, [catalogItems, stockFilter, selectedCategoryFilter, searchQuery]);

  const filteredCategories = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || String(c.id).includes(q)
    );
  }, [categories, searchQuery]);

  const filteredMealPacks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mealPacks.filter((mp) => {
      if (stockFilter === "in_stock" && mp.stock_status === "out_of_stock") {
        return false;
      }
      if (stockFilter === "out_of_stock" && mp.stock_status !== "out_of_stock") {
        return false;
      }
      if (!q) return true;
      return (
        mp.name.toLowerCase().includes(q) ||
        mp.description.toLowerCase().includes(q) ||
        String(mp.id).includes(q)
      );
    });
  }, [mealPacks, stockFilter, searchQuery]);

  // ── Image Upload Helper ──
  const handleImageFileUpload = async (
    e,
    targetSetter,
    setUploadingState,
    setBrokenState
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingState(true);
    try {
      const uploadedUrl = await CloudinaryService.uploadMedia(file, {
        folder: "cookeaze_market",
      });
      if (uploadedUrl) {
        if (setBrokenState) setBrokenState(false);
        targetSetter(uploadedUrl);
        showToast("success", "Photo uploaded and preview updated.");
      } else {
        showToast("error", "Photo upload failed. Please paste an image URL.");
      }
    } catch {
      showToast("error", "Photo upload failed.");
    } finally {
      setUploadingState(false);
    }
  };

  // ── 1. Catalog Item Create / Edit Handlers (Includes Inline Variants Management!) ──
  const handleOpenCreateItem = () => {
    userTouchedItemFormRef.current = false;
    setEditingItem(null);
    setItemFormName("");
    setItemFormCategoryId(categories[0]?.id ? String(categories[0].id) : "");
    setItemFormBaseUnit("kg");
    setItemFormEmoji("🥬");
    setItemFormImageUrl("");
    setItemImageBroken(false);
    setItemFormDescription("");
    setItemFormKeywords("");
    setItemFormIsActive(true);
    setRemovedVariantIds([]);
    setInlineCatOpen(false);
    setInlineCatName("");
    setInlineCatEmoji("🍅");
    setItemFormVariants([
      {
        id: null,
        size: "1 kg",
        unit_label: "kg",
        quantity_in_base_unit: "1",
        price: "1500.00",
        in_stock: true,
        is_active: true,
        sort_order: 0,
      },
    ]);
    setItemModalOpen(true);
  };

  const handleOpenEditItem = async (item) => {
    userTouchedItemFormRef.current = false;
    setEditingItem(item);
    setItemFormName(item.name || "");
    const resolvedCatId =
      item.category_id ||
      categories.find(
        (c) => c.name.toLowerCase() === item.category_name.toLowerCase()
      )?.id ||
      "";
    setItemFormCategoryId(resolvedCatId ? String(resolvedCatId) : "");
    setItemFormBaseUnit(item.base_unit || "kg");
    setItemFormEmoji(item.emoji || "🥬");
    setItemFormImageUrl(item.image_url || "");
    setItemImageBroken(false);
    setItemFormDescription(item.description || "");
    setItemFormKeywords(item.search_keywords || "");
    setItemFormIsActive(item.is_active !== false);
    setRemovedVariantIds([]);
    setInlineCatOpen(false);
    setInlineCatName(
      item.name.toLowerCase().includes("tomato") && !resolvedCatId
        ? "Fresh Produce & Vegetables"
        : ""
    );
    setInlineCatEmoji("🍅");

    // Populate existing variants immediately so the admin sees all sizes (e.g., 1kg, 5kg)
    const initialVars = (item.variants || []).map((v, idx) => ({
      id: v.id ?? null,
      size: v.size || "",
      unit_label: v.unit_label || item.base_unit || "kg",
      quantity_in_base_unit: String(
        v.quantity_in_base_unit ?? inferBaseQuantityFromSize(v.size)
      ),
      price: String(v.price ?? ""),
      in_stock: v.in_stock !== false,
      is_active: v.is_active !== false,
      sort_order: v.sort_order ?? idx,
    }));
    setItemFormVariants(
      initialVars.length > 0
        ? initialVars
        : [
            {
              id: null,
              size: "",
              unit_label: item.base_unit || "kg",
              quantity_in_base_unit: "1",
              price: "",
              in_stock: true,
              is_active: true,
              sort_order: 0,
            },
          ]
    );

    setItemModalOpen(true);

    // Fetch latest item detail (`GET /api/ingredients/catalog/{id}/`) without overwriting user edits
    try {
      const api = getAxiosInstance();
      const res = await api.get(`/ingredients/catalog/${item.id}/`);
      const detail = extractObject(res);
      if (detail && !userTouchedItemFormRef.current) {
        if (detail.base_unit) {
          setItemFormBaseUnit(detail.base_unit);
        }
        if (detail.search_keywords !== undefined && detail.search_keywords) {
          setItemFormKeywords(detail.search_keywords);
        }
        if (detail.description !== undefined) {
          setItemFormDescription((prev) => prev || detail.description || "");
        }
        if (detail.category_id) {
          setItemFormCategoryId(String(detail.category_id));
        } else if (typeof detail.category === "string" && detail.category) {
          const matchedCat = categories.find(
            (c) =>
              c.name.trim().toLowerCase() ===
              detail.category.trim().toLowerCase()
          );
          if (matchedCat) {
            setItemFormCategoryId(String(matchedCat.id));
          }
        }
        if (detail.image_url) {
          setItemFormImageUrl((prev) => prev || detail.image_url);
        }
        const detailVars = parseArrayField(detail.variants)
          .map(normalizeVariant)
          .filter((v) => v && v.is_active !== false);
        if (detailVars.length > 0) {
          setItemFormVariants(
            detailVars.map((v, idx) => ({
              id: v.id ?? null,
              size: v.size || "",
              unit_label:
                v.unit_label || detail.base_unit || item.base_unit || "kg",
              quantity_in_base_unit: String(
                v.quantity_in_base_unit ?? inferBaseQuantityFromSize(v.size)
              ),
              price: String(v.price ?? ""),
              in_stock: v.in_stock !== false,
              is_active: v.is_active !== false,
              sort_order: v.sort_order ?? idx,
            }))
          );
        }
      }
    } catch {
      // keep existing row fields
    }
  };

  // Sync variant `unit_label` when the admin updates the ingredient's `Base Unit`
  const handleChangeItemBaseUnit = (newUnit) => {
    userTouchedItemFormRef.current = true;
    const prevUnit = itemFormBaseUnit;
    setItemFormBaseUnit(newUnit);
    setItemFormVariants((prev) =>
      prev.map((row) => {
        if (
          !row.unit_label ||
          row.unit_label.trim().toLowerCase() ===
            prevUnit.trim().toLowerCase()
        ) {
          return { ...row, unit_label: newUnit };
        }
        return row;
      })
    );
  };

  // Quick-create a new Category inline inside the Add/Edit Ingredient modal
  const handleQuickCreateInlineCategory = async () => {
    const trimmed = inlineCatName.trim();
    if (!trimmed) {
      showToast("error", "Please enter a name for the new category.");
      return;
    }

    // Check if category already exists by name
    const existing = categories.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      userTouchedItemFormRef.current = true;
      setItemFormCategoryId(String(existing.id));
      setInlineCatOpen(false);
      showToast("success", `Selected category "${existing.name}".`);
      return;
    }

    setCreatingInlineCat(true);
    const api = getAxiosInstance();
    try {
      const res = await api.post("/ingredients/categories/", {
        name: trimmed,
        emoji: inlineCatEmoji.trim() || "🍅",
        sort_order: categories.length + 1,
        is_active: true,
      });
      const created = extractObject(res);
      const catRes = await api.get("/ingredients/categories/");
      const freshCatsRaw = extractArray(catRes, [
        "categories",
        "results",
        "data",
      ]);
      setCategoriesRaw(freshCatsRaw);

      const freshCats = freshCatsRaw.map(normalizeCategory).filter(Boolean);
      const matched =
        (created?.id &&
          freshCats.find((c) => Number(c.id) === Number(created.id))) ||
        freshCats.find(
          (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
        );

      if (matched) {
        userTouchedItemFormRef.current = true;
        setItemFormCategoryId(String(matched.id));
      }
      setInlineCatOpen(false);
      setInlineCatName("");
      showToast(
        "success",
        `Category "${trimmed}" created and selected for this ingredient.`
      );
    } catch (err) {
      showToast(
        "error",
        extractApiError(err, "Failed to create category.")
      );
    } finally {
      setCreatingInlineCat(false);
    }
  };

  const handleAddFormVariantRow = () => {
    userTouchedItemFormRef.current = true;
    setItemFormVariants((prev) => [
      ...prev,
      {
        id: null,
        size: "",
        unit_label: itemFormBaseUnit || "kg",
        quantity_in_base_unit: "1",
        price: "",
        in_stock: true,
        is_active: true,
        sort_order: prev.length,
      },
    ]);
  };

  const handleUpdateFormVariantRow = (idx, field, val) => {
    userTouchedItemFormRef.current = true;
    setItemFormVariants((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const nextRow = { ...row, [field]: val };
        if (field === "size") {
          const inferred = inferBaseQuantityFromSize(val);
          if (
            inferred > 0 &&
            (!row.quantity_in_base_unit ||
              String(row.quantity_in_base_unit) ===
                String(inferBaseQuantityFromSize(row.size)))
          ) {
            nextRow.quantity_in_base_unit = String(inferred);
          }
        }
        return nextRow;
      })
    );
  };

  const handleRemoveFormVariantRow = (idx) => {
    userTouchedItemFormRef.current = true;
    setItemFormVariants((prev) => {
      const target = prev[idx];
      if (target?.id) {
        setRemovedVariantIds((old) =>
          old.includes(target.id) ? old : [...old, target.id]
        );
      }
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSaveCatalogItem = async (e) => {
    e.preventDefault();
    const trimmedName = itemFormName.trim();
    const trimmedUnit = itemFormBaseUnit.trim();
    if (!trimmedName || !trimmedUnit) {
      showToast("error", "Ingredient name and base unit are required.");
      return;
    }

    // Validate variant rows that have partial data
    const filledVariants = itemFormVariants.filter(
      (v) => v.size.trim() !== "" || String(v.price).trim() !== ""
    );

    for (let i = 0; i < filledVariants.length; i += 1) {
      const v = filledVariants[i];
      if (!v.size.trim() || String(v.price).trim() === "") {
        showToast(
          "error",
          `Please enter both a package size label and price for Size Row #${i + 1}.`
        );
        return;
      }
    }

    const numericCatId =
      itemFormCategoryId !== "" && !Number.isNaN(Number(itemFormCategoryId))
        ? Number(itemFormCategoryId)
        : null;
    const selectedCategoryObj = numericCatId
      ? categoriesMap.get(numericCatId)
      : null;

    const payload = {
      name: trimmedName,
      base_unit: trimmedUnit,
      category_id: numericCatId,
      emoji: itemFormEmoji.trim() || "🥬",
      image_url: itemFormImageUrl.trim() ? itemFormImageUrl.trim() : null,
      description: itemFormDescription.trim(),
      search_keywords: itemFormKeywords.trim(),
      is_active: Boolean(itemFormIsActive),
    };

    setSavingItem(true);
    const api = getAxiosInstance();
    try {
      if (editingItem) {
        // 1. Update catalog item fields (`PATCH /api/ingredients/catalog/{id}/`)
        await api.patch(`/ingredients/catalog/${editingItem.id}/`, payload);

        // 2. Deactivate any existing variants the admin removed in the modal
        for (const remId of removedVariantIds) {
          try {
            await api.patch(
              `/ingredients/catalog/${editingItem.id}/variants/${remId}/`,
              { is_active: false, in_stock: false }
            );
          } catch {
            // continue if variant was already removed
          }
        }

        // 3. Sync existing and newly added package size variants (`PATCH .../variants/{id}/` & `POST .../variants/`)
        const syncedVariants = [];
        for (let idx = 0; idx < filledVariants.length; idx += 1) {
          const v = filledVariants[idx];
          const varPayload = {
            size: v.size.trim(),
            unit_label: (v.unit_label || trimmedUnit).trim(),
            quantity_in_base_unit:
              Number(v.quantity_in_base_unit) ||
              inferBaseQuantityFromSize(v.size),
            price: String(v.price).trim(),
            in_stock: Boolean(v.in_stock),
            is_active: v.is_active !== false,
            sort_order: Number(v.sort_order ?? idx),
          };

          if (v.id) {
            const vRes = await api.patch(
              `/ingredients/catalog/${editingItem.id}/variants/${v.id}/`,
              varPayload
            );
            const vObj = extractObject(vRes);
            syncedVariants.push({
              id: vObj?.id ?? v.id,
              ...varPayload,
              unit: varPayload.unit_label,
            });
          } else {
            const vRes = await api.post(
              `/ingredients/catalog/${editingItem.id}/variants/`,
              varPayload
            );
            const vObj = extractObject(vRes);
            syncedVariants.push({
              id: vObj?.id ?? null,
              ...varPayload,
              unit: varPayload.unit_label,
            });
          }
        }

        // 4. Immediately persist all updated fields in `itemDetailsMap` & `catalogRaw` so UI reflects edits immediately
        setItemDetailsMap((prev) => ({
          ...prev,
          [editingItem.id]: {
            ...(prev[editingItem.id] || {}),
            name: trimmedName,
            base_unit: trimmedUnit,
            category_id: numericCatId,
            category: selectedCategoryObj?.name || null,
            category_name: selectedCategoryObj?.name || "Uncategorized",
            emoji: payload.emoji,
            image_url: payload.image_url || "",
            description: payload.description,
            search_keywords: payload.search_keywords,
            is_active: payload.is_active,
            ...(syncedVariants.length > 0 ? { variants: syncedVariants } : {}),
          },
        }));

        showToast(
          "success",
          `Ingredient "${trimmedName}" and its package sizes updated.`
        );
      } else {
        // Create new catalog item with initial variants (`POST /api/ingredients/catalog/`)
        const cleanedVariants = filledVariants.map((v, idx) => ({
          size: v.size.trim(),
          quantity_in_base_unit:
            Number(v.quantity_in_base_unit) ||
            inferBaseQuantityFromSize(v.size),
          price: String(v.price).trim(),
          unit_label: (v.unit_label || trimmedUnit).trim(),
          in_stock: Boolean(v.in_stock),
          is_active: v.is_active !== false,
          sort_order: Number(v.sort_order ?? idx),
        }));

        if (cleanedVariants.length > 0) {
          payload.variants = cleanedVariants;
        }

        const createRes = await api.post("/ingredients/catalog/", payload);
        const createdObj = extractObject(createRes);
        if (createdObj?.id) {
          setItemDetailsMap((prev) => ({
            ...prev,
            [createdObj.id]: {
              name: trimmedName,
              base_unit: trimmedUnit,
              category_id: numericCatId,
              category: selectedCategoryObj?.name || null,
              category_name: selectedCategoryObj?.name || "Uncategorized",
              emoji: payload.emoji,
              image_url: payload.image_url || "",
              description: payload.description,
              search_keywords: payload.search_keywords,
              is_active: payload.is_active,
            },
          }));
        }
        showToast("success", `Ingredient "${trimmedName}" added to catalog.`);
      }

      setItemModalOpen(false);
      await fetchMarketData(true);
    } catch (err) {
      showToast("error", extractApiError(err, "Failed to save ingredient."));
    } finally {
      setSavingItem(false);
    }
  };

  // ── 2. Dedicated Manage Variants Modal (`POST /ingredients/catalog/{id}/variants/` & `PATCH .../variants/{variant_id}/`) ──
  const resetVariantForm = useCallback((baseUnit = "kg") => {
    setEditingVariantId(null);
    setVarFormSize("");
    setVarFormUnitLabel(baseUnit || "kg");
    setVarFormQtyBase("1");
    setVarFormPrice("");
    setVarFormInStock(true);
    setVarFormIsActive(true);
    setVarFormSortOrder("0");
  }, []);

  const handleOpenVariantsModal = async (item) => {
    setVariantsModalItem(item);
    setVariantsList(item.variants || []);
    resetVariantForm(item.base_unit);
    setLoadingVariants(true);

    try {
      const api = getAxiosInstance();
      const res = await api.get(`/ingredients/catalog/${item.id}/`);
      const detail = extractObject(res);
      if (detail) {
        const parsedVars = parseArrayField(detail.variants)
          .map(normalizeVariant)
          .filter(Boolean);
        if (parsedVars.length > 0) {
          setVariantsList(parsedVars);
        }
      }
    } catch {
      // fallback to item.variants
    } finally {
      setLoadingVariants(false);
    }
  };

  const handleSelectVariantForEdit = (v) => {
    setEditingVariantId(v.id);
    setVarFormSize(v.size || "");
    setVarFormUnitLabel(v.unit_label || variantsModalItem?.base_unit || "kg");
    setVarFormQtyBase(
      String(v.quantity_in_base_unit ?? inferBaseQuantityFromSize(v.size))
    );
    setVarFormPrice(String(v.price ?? ""));
    setVarFormInStock(v.in_stock !== false);
    setVarFormIsActive(v.is_active !== false);
    setVarFormSortOrder(String(v.sort_order ?? 0));
  };

  const handleSaveVariant = async (e) => {
    e.preventDefault();
    if (!variantsModalItem) return;
    if (!varFormSize.trim() || varFormPrice === "") {
      showToast("error", "Package size and price are required.");
      return;
    }

    const payload = {
      size: varFormSize.trim(),
      unit_label: (
        varFormUnitLabel ||
        variantsModalItem.base_unit ||
        "kg"
      ).trim(),
      quantity_in_base_unit:
        Number(varFormQtyBase) || inferBaseQuantityFromSize(varFormSize),
      price: String(varFormPrice).trim(),
      in_stock: Boolean(varFormInStock),
      is_active: Boolean(varFormIsActive),
      sort_order: Number(varFormSortOrder) || 0,
    };

    setSavingVariant(true);
    const api = getAxiosInstance();
    try {
      if (editingVariantId) {
        await api.patch(
          `/ingredients/catalog/${variantsModalItem.id}/variants/${editingVariantId}/`,
          payload
        );
        showToast("success", `Size "${payload.size}" updated.`);
      } else {
        await api.post(
          `/ingredients/catalog/${variantsModalItem.id}/variants/`,
          payload
        );
        showToast("success", `Size "${payload.size}" added.`);
      }

      const res = await api.get(
        `/ingredients/catalog/${variantsModalItem.id}/`
      );
      const detail = extractObject(res);
      if (detail) {
        const parsedVars = parseArrayField(detail.variants)
          .map(normalizeVariant)
          .filter(Boolean);
        setVariantsList(parsedVars);
        setItemDetailsMap((prev) => ({
          ...prev,
          [variantsModalItem.id]: {
            ...(prev[variantsModalItem.id] || {}),
            variants: detail.variants,
          },
        }));
      }
      resetVariantForm(variantsModalItem.base_unit);
      await fetchMarketData(true);
    } catch (err) {
      showToast("error", extractApiError(err, "Failed to save size option."));
    } finally {
      setSavingVariant(false);
    }
  };

  // ── 3. Category Create / Edit Handlers (`POST/PATCH /api/ingredients/categories/`) ──
  const handleOpenCreateCategory = () => {
    setEditingCat(null);
    setCatFormName("");
    setCatFormEmoji("🧺");
    setCatFormIconUrl("");
    setCatFormSortOrder(String(categories.length));
    setCatFormIsActive(true);
    setCatModalOpen(true);
  };

  const handleOpenEditCategory = (cat) => {
    setEditingCat(cat);
    setCatFormName(cat.name || "");
    setCatFormEmoji(cat.emoji || "🧺");
    setCatFormIconUrl(cat.icon_url || "");
    setCatFormSortOrder(String(cat.sort_order ?? 0));
    setCatFormIsActive(cat.is_active !== false);
    setCatModalOpen(true);
  };

  const handleSaveCategory = async (e) => {
    e.preventDefault();
    const trimmedName = catFormName.trim();
    if (!trimmedName) {
      showToast("error", "Category name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      emoji: catFormEmoji.trim() || "🧺",
      icon_url: catFormIconUrl.trim() ? catFormIconUrl.trim() : null,
      sort_order: Number(catFormSortOrder) || 0,
      is_active: Boolean(catFormIsActive),
    };

    setSavingCat(true);
    const api = getAxiosInstance();
    try {
      if (editingCat) {
        await api.patch(`/ingredients/categories/${editingCat.id}/`, payload);
        showToast("success", `Category "${trimmedName}" updated.`);
      } else {
        await api.post("/ingredients/categories/", payload);
        showToast("success", `Category "${trimmedName}" created.`);
      }
      setCatModalOpen(false);
      await fetchMarketData(true);
    } catch (err) {
      showToast(
        "error",
        extractApiError(err, "Failed to save ingredient category.")
      );
    } finally {
      setSavingCat(false);
    }
  };

  // ── 4. Meal Pack Create / Edit / Inspect Handlers (`/api/market/meal-packs/`) ──
  const handleOpenCreateMealPack = () => {
    setEditingPack(null);
    setPackFormName("");
    setPackFormDescription("");
    setPackFormImageUrl("");
    setPackImageBroken(false);
    setPackFormIsActive(true);
    setPackFormSortOrder("0");
    setPackPickerOpen(false);
    setPackPickerSearch("");
    setPackPickerCategory("all");
    setPickerTargetRowIndex(null);

    setPackFormItems([]);
    setPackModalOpen(true);
  };

  const handleOpenEditMealPack = async (pack) => {
    setEditingPack(pack);
    setPackFormName(pack.name || "");
    setPackFormDescription(pack.description || "");
    setPackFormImageUrl(pack.image_url || "");
    setPackImageBroken(false);
    setPackFormIsActive(pack.is_active !== false);
    setPackFormSortOrder(String(pack.sort_order ?? 0));
    setPackPickerOpen(false);
    setPackPickerSearch("");
    setPackPickerCategory("all");
    setPickerTargetRowIndex(null);

    // Hydrate from any already-loaded ingredients first
    const initialMapped = parseArrayField(pack.ingredients)
      .map((ing, idx) =>
        resolveMealPackIngredientToFormRow(ing, idx, catalogItems)
      )
      .filter(Boolean);
    setPackFormItems(initialMapped);

    setPackModalOpen(true);
    setLoadingPackDetailForEdit(true);

    try {
      const api = getAxiosInstance();
      const res = await api.get(`/market/meal-packs/${pack.id}/`);
      const detail = extractObject(res);
      if (detail) {
        if (detail.name) setPackFormName(detail.name);
        if (detail.description !== undefined) {
          setPackFormDescription(detail.description || "");
        }
        if (detail.image_url) {
          setPackFormImageUrl(detail.image_url);
        }
        const rawItems = parseArrayField(detail.ingredients ?? detail.items);
        const mappedItems = rawItems
          .map((ing, idx) =>
            resolveMealPackIngredientToFormRow(ing, idx, catalogItems)
          )
          .filter(Boolean);

        setPackFormItems(mappedItems);
      }
    } catch {
      // keep initial pack items
    } finally {
      setLoadingPackDetailForEdit(false);
    }
  };

  const handleOpenPackIngredientPicker = (rowIndex = null) => {
    setPickerTargetRowIndex(rowIndex);
    setPackPickerSearch("");
    setPackPickerCategory("all");
    setPackPickerOpen(true);
  };

  // Toggle or select an ingredient + package size from the Dedicated Ingredient Search Modal
  const handleSelectIngredientFromPicker = (item, variant) => {
    const varId = variant?.id
      ? String(variant.id)
      : item.variants?.[0]?.id
      ? String(item.variants[0].id)
      : "";

    // If user clicked "Change" on a specific row, replace that row and close the picker modal
    if (pickerTargetRowIndex !== null) {
      setPackFormItems((prev) =>
        prev.map((r, i) =>
          i === pickerTargetRowIndex
            ? {
                ...r,
                catalog_item_id: String(item.id),
                variant_id: varId,
              }
            : r
        )
      );
      setPackPickerOpen(false);
      setPickerTargetRowIndex(null);
      return;
    }

    setPackFormItems((prev) => {
      // Check if this exact ingredient + variant is already in the pack -> toggle (remove) it on click!
      const exactIdx = prev.findIndex(
        (r) =>
          String(r.catalog_item_id) === String(item.id) &&
          String(r.variant_id) === String(varId)
      );
      if (exactIdx !== -1) {
        return prev.filter((_, i) => i !== exactIdx);
      }

      // If there's an empty unselected row, fill it first
      const emptyIdx = prev.findIndex((r) => !r.catalog_item_id);
      if (emptyIdx !== -1) {
        return prev.map((r, i) =>
          i === emptyIdx
            ? {
                ...r,
                catalog_item_id: String(item.id),
                variant_id: varId,
                suggested_quantity: r.suggested_quantity || "1",
              }
            : r
        );
      }

      return [
        ...prev,
        {
          catalog_item_id: String(item.id),
          variant_id: varId,
          suggested_quantity: "1",
          sort_order: prev.length,
        },
      ];
    });

    setTimeout(() => {
      if (packItemsScrollRef.current) {
        packItemsScrollRef.current.scrollTop =
          packItemsScrollRef.current.scrollHeight;
      }
    }, 40);
  };

  // Unique category names present in catalogItems for the Picker filter pills
  const pickerCategoryNames = useMemo(() => {
    const names = [];
    const seen = new Set();
    catalogItems.forEach((c) => {
      const label = c.category_name || "Uncategorized";
      if (!seen.has(label)) {
        seen.add(label);
        names.push(label);
      }
    });
    return names;
  }, [catalogItems]);

  // Filtered catalog items for the Dedicated Ingredient Picker Modal
  const pickerFilteredCatalog = useMemo(() => {
    const q = packPickerSearch.trim().toLowerCase();
    return catalogItems.filter((c) => {
      if (packPickerCategory !== "all") {
        if ((c.category_name || "Uncategorized") !== packPickerCategory) {
          return false;
        }
      }
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.category_name.toLowerCase().includes(q) ||
        c.search_keywords.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      );
    });
  }, [catalogItems, packPickerSearch, packPickerCategory]);

  const handleUpdatePackItemRow = (idx, field, val) => {
    setPackFormItems((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        if (field === "catalog_item_id") {
          const matchedItem = catalogItems.find(
            (c) => String(c.id) === String(val)
          );
          const defaultVarId = matchedItem?.variants?.[0]?.id
            ? String(matchedItem.variants[0].id)
            : "";
          return {
            ...row,
            catalog_item_id: val,
            variant_id: defaultVarId,
          };
        }
        return { ...row, [field]: val };
      })
    );
  };

  const handleRemovePackItemRow = (idx) => {
    setPackFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Live Estimated Bundle Total in Create/Edit Meal Pack Modal
  const livePackTotal = useMemo(() => {
    return packFormItems.reduce((sum, row) => {
      const cat = catalogItems.find(
        (c) => String(c.id) === String(row.catalog_item_id)
      );
      const variant = cat?.variants?.find(
        (v) => String(v.id) === String(row.variant_id)
      );
      const unitPrice = Number(variant?.price || 0);
      const qty = Math.max(1, Number(row.suggested_quantity) || 1);
      return sum + unitPrice * qty;
    }, 0);
  }, [packFormItems, catalogItems]);

  const handleSaveMealPack = async (e) => {
    e.preventDefault();
    const trimmedName = packFormName.trim();
    if (!trimmedName) {
      showToast("error", "Meal pack name is required.");
      return;
    }

    // Validate all rows have both an ingredient and a variant selected
    for (let i = 0; i < packFormItems.length; i += 1) {
      const r = packFormItems[i];
      if (!r.catalog_item_id || !r.variant_id) {
        showToast(
          "error",
          `Please select both an ingredient and a package size for Row #${i + 1}.`
        );
        return;
      }
    }

    const cleanedItems = packFormItems
      .filter((r) => r.catalog_item_id && r.variant_id)
      .map((r, idx) => ({
        catalog_item_id: Number(r.catalog_item_id),
        variant_id: Number(r.variant_id),
        suggested_quantity: Math.max(1, Number(r.suggested_quantity) || 1),
        sort_order: idx,
      }));

    if (cleanedItems.length === 0) {
      showToast(
        "error",
        "Please include at least one ingredient and package size in this meal pack."
      );
      return;
    }

    const payload = {
      name: trimmedName,
      description: packFormDescription.trim(),
      image_url: packFormImageUrl.trim() ? packFormImageUrl.trim() : null,
      is_active: Boolean(packFormIsActive),
      sort_order: Number(packFormSortOrder) || 0,
      items: cleanedItems,
    };

    setSavingPack(true);
    const api = getAxiosInstance();
    try {
      if (editingPack) {
        await api.patch(`/market/meal-packs/${editingPack.id}/`, payload);
        showToast("success", `Meal pack "${trimmedName}" updated.`);
      } else {
        await api.post("/market/meal-packs/", payload);
        showToast("success", `Meal pack "${trimmedName}" created.`);
      }
      setPackModalOpen(false);
      await fetchMarketData(true);
    } catch (err) {
      showToast("error", extractApiError(err, "Failed to save meal pack."));
    } finally {
      setSavingPack(false);
    }
  };

  // Inspect Meal Pack Detail (`GET /api/market/meal-packs/{id}/`)
  const handleInspectMealPack = async (pack) => {
    setInspectPack(pack);
    setLoadingInspectPack(true);
    try {
      const api = getAxiosInstance();
      const res = await api.get(`/market/meal-packs/${pack.id}/`);
      const detail = extractObject(res);
      if (detail) {
        const norm = normalizeMealPack(detail);
        if (norm) {
          setInspectPack((prev) => ({
            ...prev,
            ...norm,
            ingredients:
              norm.ingredients.length > 0
                ? norm.ingredients
                : prev?.ingredients || [],
          }));
        }
      }
    } catch {
      // keep initial pack summary
    } finally {
      setLoadingInspectPack(false);
    }
  };

  // ── 6. Delete Confirmation Handler ──
  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    setDeleting(true);
    const api = getAxiosInstance();
    try {
      const { type, record } = deleteDialog;
      if (type === "item") {
        await api.delete(`/ingredients/catalog/${record.id}/`);
        showToast("success", `Ingredient "${record.name}" deleted.`);
      } else if (type === "category") {
        await api.delete(`/ingredients/categories/${record.id}/`);
        showToast("success", `Category "${record.name}" deleted.`);
      } else if (type === "pack") {
        await api.delete(`/market/meal-packs/${record.id}/`);
        showToast("success", `Meal pack "${record.name}" deleted.`);
      }
      setDeleteDialog(null);
      await fetchMarketData(true);
    } catch (err) {
      showToast(
        "error",
        extractApiError(
          err,
          "Delete failed. Verify this item is not currently bundled in an active meal pack."
        )
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="mkt-page">
      {/* ── Page Header ── */}
      <header className="mkt-header">
        <div>
          <h1 className="mkt-title">Ingredients Catalog & Meal Packs</h1>
          <p className="mkt-subtitle">
            Manage store ingredients, package sizes, categories, and ready-to-cook meal bundles.
          </p>
        </div>

        <div className="mkt-header-actions">
          <button
            type="button"
            className="mkt-btn"
            onClick={() => fetchMarketData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={14}
              className={loading || refreshing ? "mkt-spin" : ""}
            />
            Refresh
          </button>

          {activeTab === "catalog" && (
            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              onClick={handleOpenCreateItem}
            >
              <Plus size={15} />
              Add Ingredient
            </button>
          )}

          {activeTab === "categories" && (
            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              onClick={handleOpenCreateCategory}
            >
              <Plus size={15} />
              New Category
            </button>
          )}

          {activeTab === "meal-packs" && (
            <button
              type="button"
              className="mkt-btn mkt-btn-primary"
              onClick={handleOpenCreateMealPack}
            >
              <Plus size={15} />
              Create Meal Pack
            </button>
          )}
        </div>
      </header>

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`mkt-toast ${
            toast.type === "error" ? "mkt-toast-error" : "mkt-toast-success"
          }`}
          role="status"
        >
          <div className="mkt-toast-left">
            {toast.type === "error" ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="mkt-toast-close"
            onClick={() => setToast(null)}
            aria-label="Close notification"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── Clean 4-Card KPI Summary ── */}
      <section className="mkt-stats-grid" aria-label="Catalog overview">
        <div className="mkt-stat-card">
          <span className="mkt-stat-label">Catalog Ingredients</span>
          <div className="mkt-stat-value">
            {loading ? "—" : summaryStats.totalItems.toLocaleString()}
          </div>
          <span className="mkt-stat-sub">
            {summaryStats.inStockItems} in stock · {summaryStats.outOfStockItems} out of stock
          </span>
        </div>

        <div className="mkt-stat-card">
          <span className="mkt-stat-label">Package Sizes & Prices</span>
          <div className="mkt-stat-value">
            {loading ? "—" : summaryStats.totalVariants.toLocaleString()}
          </div>
          <span className="mkt-stat-sub">Configured size options across items</span>
        </div>

        <div className="mkt-stat-card">
          <span className="mkt-stat-label">Meal Packs</span>
          <div className="mkt-stat-value">
            {loading ? "—" : summaryStats.totalMealPacks.toLocaleString()}
          </div>
          <span className="mkt-stat-sub">
            {summaryStats.availablePacks} ready-to-buy bundles available
          </span>
        </div>

        <div className="mkt-stat-card">
          <span className="mkt-stat-label">Categories</span>
          <div className="mkt-stat-value">
            {loading ? "—" : summaryStats.totalCategories.toLocaleString()}
          </div>
          <span className="mkt-stat-sub">Storefront product groups</span>
        </div>
      </section>

      {/* ── Main Workbench Card ── */}
      <section className="mkt-workbench">
        {/* Top Module Tabs */}
        <div className="mkt-nav-tabs">
          <div className="mkt-nav-tabs-left" role="tablist">
            <button
              type="button"
              className={`mkt-nav-tab ${
                activeTab === "catalog" ? "active" : ""
              }`}
              onClick={() => setActiveTab("catalog")}
            >
              <Package size={15} />
              Ingredients Catalog
              <span className="mkt-nav-count">{catalogItems.length}</span>
            </button>

            <button
              type="button"
              className={`mkt-nav-tab ${
                activeTab === "meal-packs" ? "active" : ""
              }`}
              onClick={() => setActiveTab("meal-packs")}
            >
              <Boxes size={15} />
              Meal Packs
              <span className="mkt-nav-count">{mealPacks.length}</span>
            </button>

            <button
              type="button"
              className={`mkt-nav-tab ${
                activeTab === "categories" ? "active" : ""
              }`}
              onClick={() => setActiveTab("categories")}
            >
              <Layers size={15} />
              Categories
              <span className="mkt-nav-count">{categories.length}</span>
            </button>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="mkt-toolbar">
          {activeTab !== "categories" ? (
            <div className="mkt-filter-pills">
              <button
                type="button"
                className={`mkt-filter-pill ${
                  stockFilter === "all" ? "active" : ""
                }`}
                onClick={() => setStockFilter("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`mkt-filter-pill ${
                  stockFilter === "in_stock" ? "active" : ""
                }`}
                onClick={() => setStockFilter("in_stock")}
              >
                In Stock
              </button>
              <button
                type="button"
                className={`mkt-filter-pill ${
                  stockFilter === "out_of_stock" ? "active" : ""
                }`}
                onClick={() => setStockFilter("out_of_stock")}
              >
                Out of Stock
              </button>
            </div>
          ) : (
            <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#64748b" }}>
              Showing {filteredCategories.length} categories
            </div>
          )}

          <div className="mkt-toolbar-right">
            {activeTab === "catalog" && (
              <select
                className="mkt-select-filter"
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                aria-label="Filter by ingredient category"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <div className="mkt-search-wrap">
              <Search size={14} className="mkt-search-icon" />
              <input
                type="text"
                className="mkt-search-input"
                placeholder={
                  activeTab === "catalog"
                    ? "Search ingredients..."
                    : activeTab === "meal-packs"
                    ? "Search meal packs..."
                    : "Search categories..."
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="mkt-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            TAB 1: INGREDIENTS CATALOG (`/api/ingredients/catalog/`)
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "catalog" && (
          <>
            {loading ? (
              <div className="mkt-table-wrap">
                <table className="mkt-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Category</th>
                      <th>Sizes & Prices</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th className="mkt-th-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4].map((n) => (
                      <tr key={n}>
                        <td>
                          <div className="mkt-skeleton-bar" style={{ width: "180px" }} />
                        </td>
                        <td>
                          <div className="mkt-skeleton-bar" style={{ width: "110px" }} />
                        </td>
                        <td>
                          <div className="mkt-skeleton-bar" style={{ width: "160px" }} />
                        </td>
                        <td>
                          <div className="mkt-skeleton-bar" style={{ width: "70px" }} />
                        </td>
                        <td>
                          <div className="mkt-skeleton-bar" style={{ width: "75px" }} />
                        </td>
                        <td>
                          <div
                            className="mkt-skeleton-bar"
                            style={{ width: "120px", marginLeft: "auto" }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredCatalogItems.length === 0 ? (
              <div className="mkt-empty-state">
                <div className="mkt-empty-icon">
                  <Package size={20} />
                </div>
                <h3 className="mkt-empty-title">No ingredients found</h3>
                <p className="mkt-empty-sub">
                  Add ingredients and package sizes so customers can order them individually or inside meal packs.
                </p>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={handleOpenCreateItem}
                >
                  <Plus size={15} />
                  Add First Ingredient
                </button>
              </div>
            ) : (
              <>
                <div className="mkt-table-wrap">
                  <table className="mkt-table">
                    <thead>
                      <tr>
                        <th>Ingredient</th>
                        <th>Category</th>
                        <th>Sizes & Prices</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th className="mkt-th-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCatalogItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="mkt-item-media">
                              <div className="mkt-thumb-box">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="mkt-thumb-img"
                                  />
                                ) : (
                                  <span>{item.emoji}</span>
                                )}
                              </div>
                              <div className="mkt-item-info">
                                <span
                                  className="mkt-item-title"
                                  onClick={() => handleOpenEditItem(item)}
                                >
                                  {item.name}
                                </span>
                                {item.description && (
                                  <span
                                    className="mkt-item-desc"
                                    title={item.description}
                                  >
                                    {item.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <span className="mkt-badge mkt-badge-slate">
                              {item.category_name}
                            </span>
                          </td>

                          <td>
                            <div className="mkt-variants-cell">
                              {item.variants.length === 0 ? (
                                <button
                                  type="button"
                                  className="mkt-btn mkt-btn-sm"
                                  onClick={() => handleOpenVariantsModal(item)}
                                >
                                  <Plus size={12} />
                                  Add Size
                                </button>
                              ) : (
                                item.variants.map((v) => (
                                  <span
                                    key={v.id || v.size}
                                    className="mkt-variant-tag"
                                    onClick={() => handleOpenVariantsModal(item)}
                                    title="Click to manage sizes and prices"
                                  >
                                    <span>{v.size}</span>
                                    <span className="mkt-variant-sep">·</span>
                                    <span className="mkt-variant-price">
                                      {formatNaira(v.price)}
                                    </span>
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          <td>
                            <div className="mkt-stock-cell">
                              <span className="mkt-stock-qty">
                                {item.available_quantity.toLocaleString()} units
                              </span>
                            </div>
                          </td>

                          <td>
                            {item.in_stock ? (
                              <span className="mkt-badge mkt-badge-emerald">
                                <span className="mkt-badge-dot" />
                                In Stock
                              </span>
                            ) : (
                              <span className="mkt-badge mkt-badge-rose">
                                <span className="mkt-badge-dot" />
                                Out of Stock
                              </span>
                            )}
                          </td>

                          <td className="mkt-td-right">
                            <div className="mkt-row-actions">
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-sm"
                                onClick={() => handleOpenVariantsModal(item)}
                              >
                                <Sliders size={12} />
                                Sizes ({item.variants.length})
                              </button>
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-sm"
                                onClick={() => handleOpenEditItem(item)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                                onClick={() =>
                                  setDeleteDialog({
                                    type: "item",
                                    record: item,
                                  })
                                }
                                title={`Delete ${item.name}`}
                                aria-label={`Delete ${item.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile List */}
                <div className="mkt-mobile-list">
                  {filteredCatalogItems.map((item) => (
                    <div key={item.id} className="mkt-mobile-card">
                      <div className="mkt-mobile-top">
                        <div className="mkt-item-media">
                          <div className="mkt-thumb-box">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="mkt-thumb-img"
                              />
                            ) : (
                              <span>{item.emoji}</span>
                            )}
                          </div>
                          <div className="mkt-item-info">
                            <span className="mkt-item-title">{item.name}</span>
                            <span className="mkt-item-desc">
                              {item.category_name}
                            </span>
                          </div>
                        </div>

                        {item.in_stock ? (
                          <span className="mkt-badge mkt-badge-emerald">
                            <span className="mkt-badge-dot" />
                            In Stock
                          </span>
                        ) : (
                          <span className="mkt-badge mkt-badge-rose">
                            <span className="mkt-badge-dot" />
                            Out
                          </span>
                        )}
                      </div>

                      <div className="mkt-mobile-kv-grid">
                        <div className="mkt-mobile-kv">
                          <span className="mkt-mobile-kv-label">
                            Sizes & Prices
                          </span>
                          <span className="mkt-mobile-kv-val">
                            {item.variants.length > 0
                              ? item.variants
                                  .map((v) => `${v.size} (${formatNaira(v.price)})`)
                                  .join(", ")
                              : "No sizes added"}
                          </span>
                        </div>
                        <div className="mkt-mobile-kv">
                          <span className="mkt-mobile-kv-label">Stock</span>
                          <span className="mkt-mobile-kv-val">
                            {item.available_quantity} units
                          </span>
                        </div>
                      </div>

                      <div className="mkt-mobile-actions">
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-sm"
                          onClick={() => handleOpenVariantsModal(item)}
                        >
                          <Sliders size={12} />
                          Sizes ({item.variants.length})
                        </button>
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-sm"
                          onClick={() => handleOpenEditItem(item)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                          onClick={() =>
                            setDeleteDialog({ type: "item", record: item })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: MEAL PACKS (`/api/market/meal-packs/`)
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "meal-packs" && (
          <>
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                Loading meal packs...
              </div>
            ) : filteredMealPacks.length === 0 ? (
              <div className="mkt-empty-state">
                <div className="mkt-empty-icon">
                  <Boxes size={20} />
                </div>
                <h3 className="mkt-empty-title">No meal packs found</h3>
                <p className="mkt-empty-sub">
                  Bundle catalog ingredients and package sizes into convenient meal packs for customers.
                </p>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={handleOpenCreateMealPack}
                >
                  <Plus size={15} />
                  Create First Meal Pack
                </button>
              </div>
            ) : (
              <>
                <div className="mkt-table-wrap">
                  <table className="mkt-table">
                    <thead>
                      <tr>
                        <th>Meal Pack</th>
                        <th>Included Items</th>
                        <th>Bundle Price</th>
                        <th>Stock</th>
                        <th>Status</th>
                        <th className="mkt-th-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMealPacks.map((mp) => (
                        <tr key={mp.id}>
                          <td>
                            <div className="mkt-item-media">
                              <div className="mkt-thumb-box">
                                {mp.image_url ? (
                                  <img
                                    src={mp.image_url}
                                    alt={mp.name}
                                    className="mkt-thumb-img"
                                  />
                                ) : (
                                  <Boxes size={18} color="#475569" />
                                )}
                              </div>
                              <div className="mkt-item-info">
                                <span
                                  className="mkt-item-title"
                                  onClick={() => handleInspectMealPack(mp)}
                                >
                                  {mp.name}
                                </span>
                                {mp.description && (
                                  <span
                                    className="mkt-item-desc"
                                    title={mp.description}
                                  >
                                    {mp.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="mkt-variant-tag"
                              onClick={() => handleInspectMealPack(mp)}
                              title="Click to view included ingredients"
                            >
                              {mp.ingredient_count}{" "}
                              {mp.ingredient_count === 1
                                ? "ingredient"
                                : "ingredients"}
                            </button>
                          </td>

                          <td>
                            <span
                              style={{
                                fontWeight: 700,
                                color: "#0f172a",
                                fontVariantNumeric: "tabular-nums",
                              }}
                            >
                              {formatNaira(mp.estimated_price)}
                            </span>
                          </td>

                          <td>
                            <div className="mkt-stock-cell">
                              <span className="mkt-stock-qty">
                                {mp.available_quantity.toLocaleString()} available
                              </span>
                              {mp.availability_source && (
                                <span className="mkt-stock-sub">
                                  {formatSourceLabel(mp.availability_source)}
                                </span>
                              )}
                            </div>
                          </td>

                          <td>
                            {mp.stock_status !== "out_of_stock" ? (
                              <span className="mkt-badge mkt-badge-emerald">
                                <span className="mkt-badge-dot" />
                                Available
                              </span>
                            ) : (
                              <span className="mkt-badge mkt-badge-rose">
                                <span className="mkt-badge-dot" />
                                Out of Stock
                              </span>
                            )}
                          </td>

                          <td className="mkt-td-right">
                            <div className="mkt-row-actions">
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-sm"
                                onClick={() => handleInspectMealPack(mp)}
                              >
                                View Pack
                              </button>
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-sm"
                                onClick={() => handleOpenEditMealPack(mp)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                                onClick={() =>
                                  setDeleteDialog({
                                    type: "pack",
                                    record: mp,
                                  })
                                }
                                title={`Delete ${mp.name}`}
                                aria-label={`Delete ${mp.name}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Meal Pack Cards */}
                <div className="mkt-mobile-list">
                  {filteredMealPacks.map((mp) => (
                    <div key={mp.id} className="mkt-mobile-card">
                      <div className="mkt-mobile-top">
                        <div className="mkt-item-media">
                          <div className="mkt-thumb-box">
                            {mp.image_url ? (
                              <img
                                src={mp.image_url}
                                alt={mp.name}
                                className="mkt-thumb-img"
                              />
                            ) : (
                              <Boxes size={18} color="#475569" />
                            )}
                          </div>
                          <div className="mkt-item-info">
                            <span
                              className="mkt-item-title"
                              onClick={() => handleInspectMealPack(mp)}
                            >
                              {mp.name}
                            </span>
                            {mp.description && (
                              <span className="mkt-item-desc">
                                {mp.description}
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="mkt-badge mkt-badge-slate">
                          {mp.ingredient_count} items
                        </span>
                      </div>

                      <div className="mkt-mobile-kv-grid">
                        <div className="mkt-mobile-kv">
                          <span className="mkt-mobile-kv-label">
                            Bundle Price
                          </span>
                          <span className="mkt-mobile-kv-val">
                            {formatNaira(mp.estimated_price)}
                          </span>
                        </div>
                        <div className="mkt-mobile-kv">
                          <span className="mkt-mobile-kv-label">Stock</span>
                          <span className="mkt-mobile-kv-val">
                            {mp.available_quantity} available
                          </span>
                        </div>
                      </div>

                      <div className="mkt-mobile-actions">
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-sm"
                          onClick={() => handleInspectMealPack(mp)}
                        >
                          View Pack
                        </button>
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-sm"
                          onClick={() => handleOpenEditMealPack(mp)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                          onClick={() =>
                            setDeleteDialog({ type: "pack", record: mp })
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: INGREDIENT CATEGORIES (`/api/ingredients/categories/`)
            ══════════════════════════════════════════════════════════ */}
        {activeTab === "categories" && (
          <>
            {loading ? (
              <div style={{ padding: "32px", textAlign: "center", color: "#64748b" }}>
                Loading categories...
              </div>
            ) : filteredCategories.length === 0 ? (
              <div className="mkt-empty-state">
                <div className="mkt-empty-icon">
                  <Layers size={20} />
                </div>
                <h3 className="mkt-empty-title">No categories yet</h3>
                <p className="mkt-empty-sub">
                  Create categories like Grains & Pasta, Fresh Produce, Proteins, or Spices & Oils.
                </p>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={handleOpenCreateCategory}
                >
                  <Plus size={15} />
                  Create Category
                </button>
              </div>
            ) : (
              <>
                <div className="mkt-table-wrap">
                  <table className="mkt-table">
                    <thead>
                      <tr>
                        <th>Category</th>
                        <th>Linked Ingredients</th>
                        <th>Display Order</th>
                        <th>Status</th>
                        <th className="mkt-th-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCategories.map((cat) => {
                        const count = catalogItems.filter(
                          (item) =>
                            Number(item.category_id) === Number(cat.id) ||
                            item.category_name.toLowerCase() ===
                              cat.name.toLowerCase()
                        ).length;

                        return (
                          <tr key={cat.id}>
                            <td>
                              <div className="mkt-item-media">
                                <div className="mkt-thumb-box">
                                  {cat.icon_url ? (
                                    <img
                                      src={cat.icon_url}
                                      alt={cat.name}
                                      className="mkt-thumb-img"
                                    />
                                  ) : (
                                    <span>{cat.emoji}</span>
                                  )}
                                </div>
                                <div className="mkt-item-info">
                                  <span className="mkt-item-title">
                                    {cat.name}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <span className="mkt-badge mkt-badge-slate">
                                {count} {count === 1 ? "ingredient" : "ingredients"}
                              </span>
                            </td>

                            <td>
                              <span style={{ fontWeight: 600, color: "#475569" }}>
                                {cat.sort_order}
                              </span>
                            </td>

                            <td>
                              {cat.is_active ? (
                                <span className="mkt-badge mkt-badge-emerald">
                                  <span className="mkt-badge-dot" />
                                  Active
                                </span>
                              ) : (
                                <span className="mkt-badge mkt-badge-slate">
                                  <span className="mkt-badge-dot" />
                                  Hidden
                                </span>
                              )}
                            </td>

                            <td className="mkt-td-right">
                              <div className="mkt-row-actions">
                                <button
                                  type="button"
                                  className="mkt-btn mkt-btn-sm"
                                  onClick={() => handleOpenEditCategory(cat)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                                  onClick={() =>
                                    setDeleteDialog({
                                      type: "category",
                                      record: cat,
                                    })
                                  }
                                  title={`Delete ${cat.name}`}
                                  aria-label={`Delete ${cat.name}`}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="mkt-mobile-list">
                  {filteredCategories.map((cat) => (
                    <div key={cat.id} className="mkt-mobile-card">
                      <div className="mkt-mobile-top">
                        <div className="mkt-item-media">
                          <div className="mkt-thumb-box">
                            <span>{cat.emoji}</span>
                          </div>
                          <div className="mkt-item-info">
                            <span className="mkt-item-title">{cat.name}</span>
                          </div>
                        </div>
                        <div className="mkt-mobile-actions">
                          <button
                            type="button"
                            className="mkt-btn mkt-btn-sm"
                            onClick={() => handleOpenEditCategory(cat)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                            onClick={() =>
                              setDeleteDialog({
                                type: "category",
                                record: cat,
                              })
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          MODAL 1: CREATE / EDIT CATALOG INGREDIENT + PACKAGE SIZES (VARIANTS)
          ════════════════════════════════════════════════════════════════ */}
      {itemModalOpen && (
        <div
          className="mkt-modal-backdrop"
          onClick={() => !savingItem && setItemModalOpen(false)}
        >
          <div
            className="mkt-modal mkt-modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <div>
                <h2 className="mkt-modal-title">
                  {editingItem ? "Edit Ingredient & Package Sizes" : "Add New Ingredient"}
                </h2>
                <p className="mkt-modal-subtitle">
                  {editingItem
                    ? `Update product photo, details, and package sizes (e.g. 1 kg, 5 kg) for ${editingItem.name}.`
                    : "Configure ingredient details, photo preview, and package size options."}
                </p>
              </div>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => !savingItem && setItemModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCatalogItem}>
              <div className="mkt-modal-body">
                {/* 1. Prominent Visual Product Photo Preview & Upload */}
                <div className="mkt-media-preview-card">
                  <div className="mkt-media-preview-frame">
                    {itemFormImageUrl.trim() && !itemImageBroken ? (
                      <img
                        src={itemFormImageUrl.trim()}
                        alt={itemFormName || "Ingredient preview"}
                        className="mkt-media-preview-img"
                        onError={() => setItemImageBroken(true)}
                      />
                    ) : (
                      <div className="mkt-media-preview-placeholder">
                        <ImageIcon size={22} />
                        <span>{itemImageBroken ? "Invalid URL" : "No Photo"}</span>
                      </div>
                    )}
                  </div>

                  <div className="mkt-media-preview-controls">
                    <div className="mkt-media-preview-top">
                      <div>
                        <div className="mkt-media-preview-title">
                          Ingredient Photo Preview
                        </div>
                        <div className="mkt-media-preview-hint">
                          Upload a product image or paste a direct image URL below.
                        </div>
                      </div>
                      {itemFormImageUrl.trim() && (
                        <button
                          type="button"
                          className="mkt-btn mkt-btn-sm"
                          onClick={() => {
                            setItemFormImageUrl("");
                            setItemImageBroken(false);
                          }}
                        >
                          Remove Photo
                        </button>
                      )}
                    </div>

                    <div className="mkt-image-input-row">
                      <input
                        type="text"
                        className="mkt-input"
                        placeholder="https://example.com/ingredient-photo.png"
                        value={itemFormImageUrl}
                        onChange={(e) => {
                          userTouchedItemFormRef.current = true;
                          setItemImageBroken(false);
                          setItemFormImageUrl(e.target.value);
                        }}
                      />
                      <label className="mkt-btn" style={{ cursor: "pointer" }}>
                        <Upload size={14} />
                        {uploadingItemImage ? "Uploading..." : "Upload Photo"}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            userTouchedItemFormRef.current = true;
                            handleImageFileUpload(
                              e,
                              setItemFormImageUrl,
                              setUploadingItemImage,
                              setItemImageBroken
                            );
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {/* 2. Core Ingredient Details */}
                <div className="mkt-form-grid-3">
                  <div className="mkt-field" style={{ gridColumn: "span 2" }}>
                    <label className="mkt-label">
                      <span>
                        Ingredient Name<span className="mkt-label-req">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      className="mkt-input"
                      placeholder="e.g. The Grower's Harvest Long Grain Rice"
                      value={itemFormName}
                      onChange={(e) => {
                        userTouchedItemFormRef.current = true;
                        setItemFormName(e.target.value);
                      }}
                      required
                    />
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>
                        Base Unit<span className="mkt-label-req">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      className="mkt-input"
                      placeholder="e.g. kg"
                      value={itemFormBaseUnit}
                      onChange={(e) => handleChangeItemBaseUnit(e.target.value)}
                      required
                    />
                    <div className="mkt-unit-chips">
                      {BASE_UNIT_PRESETS.map((u) => (
                        <button
                          key={u}
                          type="button"
                          className={`mkt-unit-chip ${
                            itemFormBaseUnit.trim().toLowerCase() ===
                            u.toLowerCase()
                              ? "active"
                              : ""
                          }`}
                          onClick={() => handleChangeItemBaseUnit(u)}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mkt-form-grid-3">
                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>Category</span>
                      <button
                        type="button"
                        className="mkt-label-link-btn"
                        onClick={() => {
                          setInlineCatOpen((prev) => !prev);
                          if (!inlineCatName) {
                            setInlineCatName(
                              itemFormName.toLowerCase().includes("tomato")
                                ? "Fresh Produce & Vegetables"
                                : ""
                            );
                          }
                        }}
                      >
                        <Plus size={11} />
                        {inlineCatOpen ? "Cancel" : "New Category"}
                      </button>
                    </label>
                    <select
                      className="mkt-select"
                      value={itemFormCategoryId}
                      onChange={(e) => {
                        userTouchedItemFormRef.current = true;
                        setItemFormCategoryId(e.target.value);
                      }}
                    >
                      <option value="">Uncategorized</option>
                      {categories.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>

                    {inlineCatOpen && (
                      <div className="mkt-inline-cat-box">
                        <div className="mkt-inline-cat-row">
                          <input
                            type="text"
                            className="mkt-input"
                            style={{ width: 46, textAlign: "center", padding: "6px" }}
                            maxLength={8}
                            value={inlineCatEmoji}
                            onChange={(e) => setInlineCatEmoji(e.target.value)}
                            title="Category Emoji"
                          />
                          <input
                            type="text"
                            className="mkt-input"
                            style={{ padding: "6px 10px", fontSize: "0.8rem" }}
                            placeholder="e.g. Fresh Produce & Vegetables"
                            value={inlineCatName}
                            onChange={(e) => setInlineCatName(e.target.value)}
                          />
                          <button
                            type="button"
                            className="mkt-btn mkt-btn-primary mkt-btn-sm"
                            onClick={handleQuickCreateInlineCategory}
                            disabled={creatingInlineCat}
                          >
                            {creatingInlineCat ? "..." : "Add"}
                          </button>
                        </div>
                        <div className="mkt-unit-chips">
                          {[
                            { name: "Fresh Produce & Vegetables", emoji: "🍅" },
                            { name: "Oils & Condiments", emoji: "🫒" },
                            { name: "Tubers & Roots", emoji: "🥔" },
                          ].map((preset) => (
                            <button
                              key={preset.name}
                              type="button"
                              className="mkt-unit-chip"
                              onClick={() => {
                                setInlineCatName(preset.name);
                                setInlineCatEmoji(preset.emoji);
                              }}
                            >
                              {preset.emoji} {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>Search Keywords</span>
                      <span className="mkt-label-hint">Optional</span>
                    </label>
                    <input
                      type="text"
                      className="mkt-input"
                      placeholder="e.g. parboiled rice, jollof, grains"
                      value={itemFormKeywords}
                      onChange={(e) => {
                        userTouchedItemFormRef.current = true;
                        setItemFormKeywords(e.target.value);
                      }}
                    />
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">Store Visibility</label>
                    <select
                      className="mkt-select"
                      value={itemFormIsActive ? "true" : "false"}
                      onChange={(e) => {
                        userTouchedItemFormRef.current = true;
                        setItemFormIsActive(e.target.value === "true");
                      }}
                    >
                      <option value="true">Visible in Store</option>
                      <option value="false">Hidden</option>
                    </select>
                  </div>
                </div>

                <div className="mkt-field">
                  <label className="mkt-label">
                    <span>Short Description</span>
                    <span className="mkt-label-hint">Optional</span>
                  </label>
                  <textarea
                    className="mkt-textarea"
                    placeholder="Brief description shown to customers..."
                    value={itemFormDescription}
                    onChange={(e) => {
                      userTouchedItemFormRef.current = true;
                      setItemFormDescription(e.target.value);
                    }}
                  />
                </div>

                {/* 3. Package Sizes & Prices (Variants) — Available on BOTH Add and Edit! */}
                <div className="mkt-builder-box">
                  <div className="mkt-builder-header">
                    <div>
                      <div className="mkt-builder-title">
                        Package Sizes & Prices (Variants) ({itemFormVariants.length})
                      </div>
                      <div className="mkt-builder-sub">
                        Add different selling sizes for this ingredient (e.g. 1 kg, 5 kg, 25 kg bag for Rice).
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mkt-btn mkt-btn-sm"
                      onClick={handleAddFormVariantRow}
                    >
                      <Plus size={12} />
                      Add Another Size
                    </button>
                  </div>

                  <div className="mkt-builder-items-scroll">
                    <div className="mkt-builder-col-headers">
                      <span>Size Label (e.g. 1 kg, 5 kg)</span>
                      <span>Unit Label</span>
                      <span>Base Qty</span>
                      <span>Selling Price (₦)</span>
                      <span>Stock Status</span>
                      <span />
                    </div>

                    {itemFormVariants.map((row, idx) => (
                      <div key={row.id || `new-${idx}`} className="mkt-builder-row">
                        <input
                          type="text"
                          className="mkt-input"
                          placeholder="e.g. 1 kg, 5 kg, 400g jar"
                          value={row.size}
                          onChange={(e) =>
                            handleUpdateFormVariantRow(idx, "size", e.target.value)
                          }
                        />
                        <input
                          type="text"
                          className="mkt-input"
                          placeholder={itemFormBaseUnit || "kg"}
                          value={row.unit_label}
                          onChange={(e) =>
                            handleUpdateFormVariantRow(
                              idx,
                              "unit_label",
                              e.target.value
                            )
                          }
                        />
                        <input
                          type="number"
                          step="any"
                          className="mkt-input"
                          placeholder="1"
                          title="Quantity in base unit (e.g. 5 for a 5kg bag when base unit is kg)"
                          value={row.quantity_in_base_unit}
                          onChange={(e) =>
                            handleUpdateFormVariantRow(
                              idx,
                              "quantity_in_base_unit",
                              e.target.value
                            )
                          }
                        />
                        <input
                          type="number"
                          step="0.01"
                          className="mkt-input"
                          placeholder="2000.00"
                          value={row.price}
                          onChange={(e) =>
                            handleUpdateFormVariantRow(idx, "price", e.target.value)
                          }
                        />
                        <select
                          className="mkt-select"
                          value={row.in_stock ? "true" : "false"}
                          onChange={(e) =>
                            handleUpdateFormVariantRow(
                              idx,
                              "in_stock",
                              e.target.value === "true"
                            )
                          }
                        >
                          <option value="true">In Stock</option>
                          <option value="false">Out of Stock</option>
                        </select>

                        {itemFormVariants.length > 1 ? (
                          <button
                            type="button"
                            className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                            onClick={() => handleRemoveFormVariantRow(idx)}
                            title="Remove size option"
                            aria-label="Remove size option"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <span
                            style={{
                              fontSize: "0.7rem",
                              color: "#94a3b8",
                              textAlign: "center",
                            }}
                            title={row.id ? `Saved Variant #${row.id}` : ""}
                          >
                            {row.id ? `#${row.id}` : ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mkt-modal-footer">
                <div className="mkt-modal-footer-right">
                  <button
                    type="button"
                    className="mkt-btn"
                    onClick={() => setItemModalOpen(false)}
                    disabled={savingItem}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mkt-btn mkt-btn-primary"
                    disabled={savingItem}
                  >
                    {savingItem
                      ? "Saving..."
                      : editingItem
                      ? "Save Changes"
                      : "Create Ingredient"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 2: DEDICATED PACKAGE SIZES & PRICES MANAGER (`.../variants/`)
          ════════════════════════════════════════════════════════════════ */}
      {variantsModalItem && (
        <div
          className="mkt-modal-backdrop"
          onClick={() => !savingVariant && setVariantsModalItem(null)}
        >
          <div
            className="mkt-modal mkt-modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div className="mkt-thumb-box">
                  {variantsModalItem.image_url ? (
                    <img
                      src={variantsModalItem.image_url}
                      alt={variantsModalItem.name}
                      className="mkt-thumb-img"
                    />
                  ) : (
                    <span>{variantsModalItem.emoji}</span>
                  )}
                </div>
                <div>
                  <h2 className="mkt-modal-title">
                    Package Sizes & Prices — {variantsModalItem.name}
                  </h2>
                  <p className="mkt-modal-subtitle">
                    Base unit: <strong>{variantsModalItem.base_unit}</strong> · Add or update size variants below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => !savingVariant && setVariantsModalItem(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mkt-modal-body">
              {/* Existing Variants Table */}
              <div className="mkt-receipt-box">
                <div className="mkt-builder-header">
                  <span className="mkt-builder-title">
                    Configured Package Sizes ({variantsList.length})
                  </span>
                  {editingVariantId && (
                    <button
                      type="button"
                      className="mkt-btn mkt-btn-sm"
                      onClick={() =>
                        resetVariantForm(variantsModalItem.base_unit)
                      }
                    >
                      + Add New Size Instead
                    </button>
                  )}
                </div>

                {loadingVariants ? (
                  <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>
                    Loading sizes...
                  </div>
                ) : variantsList.length === 0 ? (
                  <div
                    style={{
                      padding: "20px",
                      textAlign: "center",
                      fontSize: "0.84rem",
                      color: "#64748b",
                    }}
                  >
                    No package sizes configured yet. Use the form below to add your first size option.
                  </div>
                ) : (
                  <table className="mkt-table">
                    <thead>
                      <tr>
                        <th>Size Label</th>
                        <th>Unit</th>
                        <th>Base Unit Qty</th>
                        <th>Price</th>
                        <th>Availability</th>
                        <th className="mkt-th-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variantsList.map((v) => (
                        <tr
                          key={v.id || v.size}
                          style={
                            editingVariantId === v.id
                              ? { background: "#f0fdf4" }
                              : undefined
                          }
                        >
                          <td style={{ fontWeight: 700 }}>{v.size}</td>
                          <td>{v.unit_label}</td>
                          <td>
                            {v.quantity_in_base_unit} {variantsModalItem.base_unit}
                          </td>
                          <td style={{ fontWeight: 700 }}>
                            {formatNaira(v.price)}
                          </td>
                          <td>
                            {v.in_stock ? (
                              <span className="mkt-badge mkt-badge-emerald">
                                <span className="mkt-badge-dot" />
                                In Stock
                              </span>
                            ) : (
                              <span className="mkt-badge mkt-badge-rose">
                                <span className="mkt-badge-dot" />
                                Out of Stock
                              </span>
                            )}
                          </td>
                          <td className="mkt-td-right">
                            <button
                              type="button"
                              className="mkt-btn mkt-btn-sm"
                              onClick={() => handleSelectVariantForEdit(v)}
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Add / Edit Variant Form */}
              <form
                onSubmit={handleSaveVariant}
                className="mkt-receipt-box"
                style={{ padding: "18px" }}
              >
                <div
                  style={{
                    fontSize: "0.86rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    marginBottom: "14px",
                  }}
                >
                  {editingVariantId
                    ? `Editing Size Option: ${varFormSize || `#${editingVariantId}`}`
                    : "Add New Package Size"}
                </div>

                <div className="mkt-form-grid-3" style={{ marginBottom: "14px" }}>
                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>
                        Size Label<span className="mkt-label-req">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      className="mkt-input"
                      placeholder="e.g. 1 kg, 5 kg, 500g"
                      value={varFormSize}
                      onChange={(e) => setVarFormSize(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>
                        Unit Label<span className="mkt-label-req">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      className="mkt-input"
                      placeholder="e.g. kg, g, bag"
                      value={varFormUnitLabel}
                      onChange={(e) => setVarFormUnitLabel(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>
                        Price (₦)<span className="mkt-label-req">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="mkt-input"
                      placeholder="e.g. 2000.00"
                      value={varFormPrice}
                      onChange={(e) => setVarFormPrice(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="mkt-form-grid-3" style={{ marginBottom: "16px" }}>
                  <div className="mkt-field">
                    <label className="mkt-label">
                      <span>Quantity in Base Unit</span>
                      <span className="mkt-label-hint">
                        in {variantsModalItem.base_unit}
                      </span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="mkt-input"
                      value={varFormQtyBase}
                      onChange={(e) => setVarFormQtyBase(e.target.value)}
                    />
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">Stock Status</label>
                    <select
                      className="mkt-select"
                      value={varFormInStock ? "true" : "false"}
                      onChange={(e) =>
                        setVarFormInStock(e.target.value === "true")
                      }
                    >
                      <option value="true">In Stock</option>
                      <option value="false">Out of Stock</option>
                    </select>
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">Visibility</label>
                    <select
                      className="mkt-select"
                      value={varFormIsActive ? "true" : "false"}
                      onChange={(e) =>
                        setVarFormIsActive(e.target.value === "true")
                      }
                    >
                      <option value="true">Visible</option>
                      <option value="false">Hidden</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  {editingVariantId && (
                    <button
                      type="button"
                      className="mkt-btn"
                      onClick={() =>
                        resetVariantForm(variantsModalItem.base_unit)
                      }
                    >
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    className="mkt-btn mkt-btn-primary"
                    disabled={savingVariant}
                  >
                    {savingVariant
                      ? "Saving..."
                      : editingVariantId
                      ? "Update Size Option"
                      : "Add Size Option"}
                  </button>
                </div>
              </form>
            </div>

            <div className="mkt-modal-footer">
              <div className="mkt-modal-footer-right">
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={() => setVariantsModalItem(null)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 3: CREATE / EDIT INGREDIENT CATEGORY (`IngredientCategoryWrite`)
          ════════════════════════════════════════════════════════════════ */}
      {catModalOpen && (
        <div
          className="mkt-modal-backdrop"
          onClick={() => !savingCat && setCatModalOpen(false)}
        >
          <div
            className="mkt-modal mkt-modal-sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <div>
                <h2 className="mkt-modal-title">
                  {editingCat ? "Edit Category" : "New Ingredient Category"}
                </h2>
              </div>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => !savingCat && setCatModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCategory}>
              <div className="mkt-modal-body">
                <div className="mkt-field">
                  <label className="mkt-label">
                    <span>
                      Category Name<span className="mkt-label-req">*</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    className="mkt-input"
                    placeholder="e.g. Grains & Pasta"
                    value={catFormName}
                    onChange={(e) => setCatFormName(e.target.value)}
                    required
                  />
                </div>

                <div className="mkt-form-grid-2">
                  <div className="mkt-field">
                    <label className="mkt-label">Emoji Icon</label>
                    <input
                      type="text"
                      className="mkt-input"
                      maxLength={10}
                      placeholder="🌾"
                      value={catFormEmoji}
                      onChange={(e) => setCatFormEmoji(e.target.value)}
                    />
                  </div>

                  <div className="mkt-field">
                    <label className="mkt-label">Display Order</label>
                    <input
                      type="number"
                      className="mkt-input"
                      value={catFormSortOrder}
                      onChange={(e) => setCatFormSortOrder(e.target.value)}
                    />
                  </div>
                </div>

                <div className="mkt-field">
                  <label className="mkt-label">
                    <span>Custom Icon URL</span>
                    <span className="mkt-label-hint">Optional</span>
                  </label>
                  <input
                    type="text"
                    className="mkt-input"
                    placeholder="https://..."
                    value={catFormIconUrl}
                    onChange={(e) => setCatFormIconUrl(e.target.value)}
                  />
                </div>

                <div className="mkt-field">
                  <label className="mkt-label">Visibility</label>
                  <select
                    className="mkt-select"
                    value={catFormIsActive ? "true" : "false"}
                    onChange={(e) =>
                      setCatFormIsActive(e.target.value === "true")
                    }
                  >
                    <option value="true">Active (Visible)</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="mkt-modal-footer">
                <div className="mkt-modal-footer-right">
                  <button
                    type="button"
                    className="mkt-btn"
                    onClick={() => setCatModalOpen(false)}
                    disabled={savingCat}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mkt-btn mkt-btn-primary"
                    disabled={savingCat}
                  >
                    {savingCat ? "Saving..." : "Save Category"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 4: CREATE / EDIT MEAL PACK (`MealPackWrite`)
          ════════════════════════════════════════════════════════════════ */}
      {packModalOpen && (
        <div
          className="mkt-modal-backdrop"
          onClick={() => !savingPack && setPackModalOpen(false)}
        >
          <div
            className="mkt-modal mkt-modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <div>
                <h2 className="mkt-modal-title">
                  {editingPack ? "Edit Meal Pack" : "Create Meal Pack"}
                </h2>
                <p className="mkt-modal-subtitle">
                  {editingPack
                    ? `Update cover photo, description, and bundled ingredients for ${editingPack.name}.`
                    : "Combine catalog ingredients and specific package sizes into a ready-to-buy bundle."}
                </p>
              </div>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => !savingPack && setPackModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveMealPack}>
              <div className="mkt-modal-body">
                {/* 1. Balanced 2-Column Top Layout: Large 132x132 Cover Photo Preview + Fields */}
                <div className="mkt-pack-top-layout">
                  <label
                    className={`mkt-pack-cover-box ${
                      packFormImageUrl.trim() && !packImageBroken
                        ? "has-image"
                        : ""
                    }`}
                    title="Click to upload meal pack cover photo"
                  >
                    {packFormImageUrl.trim() && !packImageBroken ? (
                      <img
                        src={packFormImageUrl.trim()}
                        alt={packFormName || "Meal pack preview"}
                        className="mkt-pack-cover-img"
                        onError={() => setPackImageBroken(true)}
                      />
                    ) : (
                      <div className="mkt-pack-cover-placeholder">
                        <ImageIcon size={24} />
                        <span>
                          {uploadingPackImage ? "Uploading..." : "Cover Photo"}
                        </span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) =>
                        handleImageFileUpload(
                          e,
                          setPackFormImageUrl,
                          setUploadingPackImage,
                          setPackImageBroken
                        )
                      }
                    />
                  </label>

                  <div className="mkt-pack-top-fields">
                    <div className="mkt-form-grid-3">
                      <div
                        className="mkt-field"
                        style={{ gridColumn: "span 2" }}
                      >
                        <label className="mkt-label">
                          <span>
                            Meal Pack Name
                            <span className="mkt-label-req">*</span>
                          </span>
                        </label>
                        <input
                          type="text"
                          className="mkt-input"
                          placeholder="e.g. Jollof Rice Starter Pack"
                          value={packFormName}
                          onChange={(e) => setPackFormName(e.target.value)}
                          required
                        />
                      </div>

                      <div className="mkt-field">
                        <label className="mkt-label">Store Visibility</label>
                        <select
                          className="mkt-select"
                          value={packFormIsActive ? "true" : "false"}
                          onChange={(e) =>
                            setPackFormIsActive(e.target.value === "true")
                          }
                        >
                          <option value="true">Visible in Store</option>
                          <option value="false">Hidden</option>
                        </select>
                      </div>
                    </div>

                    <div className="mkt-field">
                      <label className="mkt-label">
                        <span>Cover Photo URL</span>
                        <span className="mkt-label-hint">Optional</span>
                      </label>
                      <div className="mkt-photo-url-row">
                        <input
                          type="text"
                          className="mkt-input"
                          placeholder="Paste image URL or click Upload Photo..."
                          value={packFormImageUrl}
                          onChange={(e) => {
                            setPackImageBroken(false);
                            setPackFormImageUrl(e.target.value);
                          }}
                        />

                        <label
                          className="mkt-btn"
                          style={{ cursor: "pointer" }}
                        >
                          <Upload size={14} />
                          {uploadingPackImage ? "Uploading..." : "Upload Photo"}
                          <input
                            type="file"
                            accept="image/*"
                            style={{ display: "none" }}
                            onChange={(e) =>
                              handleImageFileUpload(
                                e,
                                setPackFormImageUrl,
                                setUploadingPackImage,
                                setPackImageBroken
                              )
                            }
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Description */}
                <div className="mkt-field">
                  <label className="mkt-label">
                    <span>Description</span>
                    <span className="mkt-label-hint">Optional</span>
                  </label>
                  <textarea
                    rows={2}
                    className="mkt-textarea"
                    placeholder="Short summary of what this meal pack prepares..."
                    value={packFormDescription}
                    onChange={(e) => setPackFormDescription(e.target.value)}
                  />
                </div>

                {/* 4. Included Ingredients & Sizes Builder */}
                <div className="mkt-builder-box">
                  <div className="mkt-builder-header">
                    <div className="mkt-builder-title">
                      Included Ingredients (
                      {
                        packFormItems.filter((r) => Boolean(r.catalog_item_id))
                          .length
                      }
                      )
                    </div>
                    <button
                      type="button"
                      className="mkt-btn mkt-btn-primary mkt-btn-sm"
                      onClick={() => handleOpenPackIngredientPicker(null)}
                    >
                      <Plus size={13} />
                      Add Ingredients
                    </button>
                  </div>

                  {packFormItems.length === 0 ? (
                    <div className="mkt-pack-empty-compact">
                      {loadingPackDetailForEdit ? (
                        "Loading included ingredients..."
                      ) : (
                        <>
                          No ingredients added yet — click{" "}
                          <strong>+ Add Ingredients</strong> to select from the
                          catalog.
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div
                        className="mkt-pack-items-scroll"
                        ref={packItemsScrollRef}
                      >
                        <div className="mkt-pack-col-headers">
                          <span>Ingredient</span>
                          <span>Package Size & Price</span>
                          <span>Quantity</span>
                          <span style={{ textAlign: "right" }}>Subtotal</span>
                          <span />
                        </div>

                        {packFormItems.map((row, idx) => {
                          const selectedCatalog = catalogItems.find(
                            (c) => String(c.id) === String(row.catalog_item_id)
                          );
                          const availableVariants =
                            selectedCatalog?.variants || [];
                          const selectedVariant = availableVariants.find(
                            (v) => String(v.id) === String(row.variant_id)
                          );
                          const unitPrice = Number(selectedVariant?.price || 0);
                          const qty = Math.max(
                            1,
                            Number(row.suggested_quantity) || 1
                          );
                          const rowSubtotal = unitPrice * qty;

                          return (
                            <div key={idx} className="mkt-pack-item-row">
                              {/* Column 1: Selected Ingredient Identity + Change Trigger */}
                              <div className="mkt-pack-item-identity">
                                <div className="mkt-pack-row-thumb">
                                  {selectedCatalog?.image_url ? (
                                    <img
                                      src={selectedCatalog.image_url}
                                      alt={selectedCatalog.name}
                                      className="mkt-thumb-img"
                                    />
                                  ) : (
                                    <Package size={16} color="#64748b" />
                                  )}
                                </div>
                                <div className="mkt-pack-item-info">
                                  <div className="mkt-pack-item-name">
                                    {selectedCatalog
                                      ? selectedCatalog.name
                                      : "Select an ingredient"}
                                  </div>
                                  <div className="mkt-pack-item-meta">
                                    {selectedCatalog?.category_name && (
                                      <span>{selectedCatalog.category_name}</span>
                                    )}
                                    <button
                                      type="button"
                                      className="mkt-pack-change-btn"
                                      onClick={() =>
                                        handleOpenPackIngredientPicker(idx)
                                      }
                                    >
                                      {selectedCatalog ? "Change" : "Choose..."}
                                    </button>
                                  </div>
                                </div>
                              </div>

                              {/* Column 2: Variant / Package Size Select */}
                              <select
                                className="mkt-select"
                                value={row.variant_id}
                                disabled={!selectedCatalog}
                                onChange={(e) =>
                                  handleUpdatePackItemRow(
                                    idx,
                                    "variant_id",
                                    e.target.value
                                  )
                                }
                              >
                                {!selectedCatalog ? (
                                  <option value="">
                                    Choose ingredient first...
                                  </option>
                                ) : availableVariants.length === 0 ? (
                                  <option value="">No sizes configured</option>
                                ) : (
                                  <>
                                    <option value="">Select package size...</option>
                                    {availableVariants.map((v) => (
                                      <option key={v.id} value={String(v.id)}>
                                        {v.size} — {formatNaira(v.price)}
                                      </option>
                                    ))}
                                  </>
                                )}
                              </select>

                              {/* Column 3: Clean Quantity Stepper */}
                              <div className="mkt-pack-qty-stepper">
                                <button
                                  type="button"
                                  className="mkt-pack-qty-btn"
                                  onClick={() =>
                                    handleUpdatePackItemRow(
                                      idx,
                                      "suggested_quantity",
                                      String(Math.max(1, qty - 1))
                                    )
                                  }
                                  aria-label="Decrease quantity"
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  className="mkt-pack-qty-input"
                                  value={row.suggested_quantity}
                                  onChange={(e) =>
                                    handleUpdatePackItemRow(
                                      idx,
                                      "suggested_quantity",
                                      e.target.value
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="mkt-pack-qty-btn"
                                  onClick={() =>
                                    handleUpdatePackItemRow(
                                      idx,
                                      "suggested_quantity",
                                      String(qty + 1)
                                    )
                                  }
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>

                              {/* Column 4: Line Subtotal */}
                              <div className="mkt-pack-row-subtotal">
                                {rowSubtotal > 0
                                  ? formatNaira(rowSubtotal)
                                  : "—"}
                              </div>

                              {/* Column 5: Remove Row Button */}
                              <button
                                type="button"
                                className="mkt-btn mkt-btn-icon mkt-btn-danger-outline"
                                onClick={() => handleRemovePackItemRow(idx)}
                                title="Remove ingredient from meal pack"
                                aria-label="Remove ingredient from pack"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Bundle Total Summary Bar */}
                      <div className="mkt-pack-summary-bar">
                        <span style={{ color: "#64748b", fontWeight: 600 }}>
                          Total Bundle Estimate (
                          {
                            packFormItems.filter((r) =>
                              Boolean(r.catalog_item_id)
                            ).length
                          }{" "}
                          {packFormItems.filter((r) =>
                            Boolean(r.catalog_item_id)
                          ).length === 1
                            ? "ingredient"
                            : "ingredients"}
                          )
                        </span>
                        <span
                          style={{
                            fontSize: "0.95rem",
                            fontWeight: 800,
                            color: "#0f172a",
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {formatNaira(livePackTotal)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="mkt-modal-footer">
                <div className="mkt-modal-footer-right">
                  <button
                    type="button"
                    className="mkt-btn"
                    onClick={() => setPackModalOpen(false)}
                    disabled={savingPack}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="mkt-btn mkt-btn-primary"
                    disabled={savingPack}
                  >
                    {savingPack
                      ? "Saving..."
                      : editingPack
                      ? "Save Changes"
                      : "Create Meal Pack"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 4B: DEDICATED INGREDIENT SEARCH & PICKER FOR MEAL PACKS
          ════════════════════════════════════════════════════════════════ */}
      {packModalOpen && packPickerOpen && (
        <div
          className="mkt-picker-modal-backdrop"
          onClick={() => {
            setPackPickerOpen(false);
            setPickerTargetRowIndex(null);
          }}
        >
          <div
            className="mkt-picker-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <h2 className="mkt-modal-title">
                {pickerTargetRowIndex !== null
                  ? "Change Ingredient"
                  : "Select Ingredients"}
              </h2>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => {
                  setPackPickerOpen(false);
                  setPickerTargetRowIndex(null);
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Clean Search + Category Filter Bar */}
            <div className="mkt-picker-toolbar">
              <div className="mkt-picker-search-wrap">
                <Search size={15} className="mkt-picker-search-icon" />
                <input
                  type="text"
                  className="mkt-picker-search-input"
                  placeholder="Search ingredient by name or category..."
                  value={packPickerSearch}
                  onChange={(e) => setPackPickerSearch(e.target.value)}
                  autoFocus
                />
                {packPickerSearch && (
                  <button
                    type="button"
                    className="mkt-search-clear"
                    onClick={() => setPackPickerSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {pickerCategoryNames.length > 0 && (
                <div className="mkt-picker-cat-pills">
                  <button
                    type="button"
                    className={`mkt-picker-cat-pill ${
                      packPickerCategory === "all" ? "active" : ""
                    }`}
                    onClick={() => setPackPickerCategory("all")}
                  >
                    All
                  </button>
                  {pickerCategoryNames.map((catName) => (
                    <button
                      key={catName}
                      type="button"
                      className={`mkt-picker-cat-pill ${
                        packPickerCategory === catName ? "active" : ""
                      }`}
                      onClick={() => setPackPickerCategory(catName)}
                    >
                      {catName}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Clean, Minimal Ingredient List (No Dropdown Boxes or Table Headers) */}
            <div className="mkt-picker-list">
              {pickerFilteredCatalog.length === 0 ? (
                <div
                  style={{
                    padding: "40px 20px",
                    textAlign: "center",
                    color: "#64748b",
                    fontSize: "0.83rem",
                  }}
                >
                  No catalog ingredients match &ldquo;{packPickerSearch}&rdquo;.
                </div>
              ) : (
                pickerFilteredCatalog.map((item) => {
                  const rowsForThisItem = packFormItems.filter(
                    (r) => String(r.catalog_item_id) === String(item.id)
                  );
                  const isItemInPack = rowsForThisItem.length > 0;
                  const defaultVariant =
                    item.variants.find(
                      (v) =>
                        String(v.id) === String(rowsForThisItem[0]?.variant_id)
                    ) ||
                    item.variants[0] ||
                    null;

                  const priceSummary = defaultVariant
                    ? `${defaultVariant.size} · ${formatNaira(
                        defaultVariant.price
                      )}${
                        item.variants.length > 1
                          ? ` (+${item.variants.length - 1} more size)`
                          : ""
                      }`
                    : item.base_unit;

                  return (
                    <div
                      key={item.id}
                      className={`mkt-picker-row ${
                        isItemInPack ? "is-selected" : ""
                      }`}
                      onClick={() =>
                        handleSelectIngredientFromPicker(item, defaultVariant)
                      }
                    >
                      <div className="mkt-picker-row-left">
                        <div className="mkt-picker-thumb">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="mkt-thumb-img"
                            />
                          ) : (
                            <Package size={17} color="#64748b" />
                          )}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="mkt-picker-title-line">
                            <span
                              className="mkt-picker-item-name"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                          </div>
                          <div className="mkt-picker-card-sub">
                            {item.category_name || "Uncategorized"} ·{" "}
                            {priceSummary}
                          </div>
                        </div>
                      </div>

                      <div className="mkt-picker-row-action">
                        {isItemInPack && pickerTargetRowIndex === null ? (
                          <span className="mkt-ai-selected-badge">
                            Selected
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="mkt-picker-action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectIngredientFromPicker(
                                item,
                                defaultVariant
                              );
                            }}
                          >
                            <Plus size={12} />
                            {pickerTargetRowIndex !== null ? "Select" : "Add"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mkt-modal-footer">
              <div className="mkt-picker-footer-summary">
                <span className="mkt-ai-selected-badge">
                  {
                    packFormItems.filter((r) => Boolean(r.catalog_item_id))
                      .length
                  }{" "}
                  selected
                </span>
                <span className="mkt-picker-footer-total">
                  Est. {formatNaira(livePackTotal)}
                </span>
              </div>
              <div className="mkt-modal-footer-right">
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={() => {
                    setPackPickerOpen(false);
                    setPickerTargetRowIndex(null);
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 5: INSPECT MEAL PACK BUNDLE (`GET /api/market/meal-packs/{id}/`)
          ════════════════════════════════════════════════════════════════ */}
      {inspectPack && (
        <div
          className="mkt-modal-backdrop"
          onClick={() => setInspectPack(null)}
        >
          <div
            className="mkt-modal mkt-modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <h2 className="mkt-modal-title">Meal Pack Overview</h2>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => setInspectPack(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mkt-modal-body">
              <div className="mkt-receipt-box">
                <div className="mkt-receipt-hero">
                  <div className="mkt-receipt-hero-left">
                    <div
                      className="mkt-thumb-box"
                      style={{ width: 64, height: 64, borderRadius: 10 }}
                    >
                      {inspectPack.image_url ? (
                        <img
                          src={inspectPack.image_url}
                          alt={inspectPack.name}
                          className="mkt-thumb-img"
                        />
                      ) : (
                        <Boxes size={24} color="#475569" />
                      )}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          fontWeight: 700,
                          color: "#0f172a",
                        }}
                      >
                        {inspectPack.name}
                      </div>
                      {inspectPack.description && (
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#64748b",
                            marginTop: "3px",
                            maxWidth: "460px",
                          }}
                        >
                          {inspectPack.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <span className="mkt-badge mkt-badge-emerald">
                      {formatNaira(inspectPack.estimated_price)}
                    </span>
                    <span className="mkt-badge mkt-badge-slate">
                      {inspectPack.ingredient_count} Ingredients
                    </span>
                  </div>
                </div>

                <div className="mkt-receipt-kv-grid">
                  <div className="mkt-receipt-kv-item">
                    <span className="mkt-receipt-kv-label">
                      Available Packs
                    </span>
                    <span className="mkt-receipt-kv-val">
                      {inspectPack.available_quantity} available
                    </span>
                  </div>
                  <div className="mkt-receipt-kv-item">
                    <span className="mkt-receipt-kv-label">Inventory Source</span>
                    <span className="mkt-receipt-kv-val">
                      {formatSourceLabel(inspectPack.availability_source) ||
                        "Warehouse Stock"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mkt-receipt-box">
                <div className="mkt-builder-header">
                  <span className="mkt-builder-title">
                    Included Ingredients ({inspectPack.ingredients?.length || 0})
                  </span>
                </div>

                {loadingInspectPack ? (
                  <div
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "#64748b",
                    }}
                  >
                    Loading bundled ingredients...
                  </div>
                ) : !Array.isArray(inspectPack.ingredients) ||
                  inspectPack.ingredients.length === 0 ? (
                  <div
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "#64748b",
                      fontSize: "0.84rem",
                    }}
                  >
                    No component ingredients returned for this pack.
                  </div>
                ) : (
                  <div className="mkt-pack-inspect-scroll">
                    <table className="mkt-table">
                      <thead>
                        <tr>
                          <th>Ingredient</th>
                          <th>Package Size</th>
                          <th>Quantity</th>
                          <th>Unit Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inspectPack.ingredients.map((ing, idx) => {
                          const resolvedRow = resolveMealPackIngredientToFormRow(
                            ing,
                            idx,
                            catalogItems
                          );
                          const matchedCat = resolvedRow
                            ? catalogItems.find(
                                (c) =>
                                  String(c.id) ===
                                  String(resolvedRow.catalog_item_id)
                              )
                            : null;
                          const matchedVar = matchedCat?.variants?.find(
                            (v) =>
                              String(v.id) === String(resolvedRow?.variant_id)
                          );
                          const thumbUrl =
                            ing.image_url || matchedCat?.image_url || "";
                          const displaySize =
                            ing.size ||
                            ing.variant_size ||
                            matchedVar?.size ||
                            ing.unit_label ||
                            "—";
                          const displayPrice =
                            ing.price ?? ing.unit_price ?? matchedVar?.price;

                          return (
                            <tr key={ing.id || idx}>
                              <td>
                                <div className="mkt-item-media">
                                  <div
                                    className="mkt-thumb-box"
                                    style={{ width: 36, height: 36 }}
                                  >
                                    {thumbUrl ? (
                                      <img
                                        src={thumbUrl}
                                        alt=""
                                        className="mkt-thumb-img"
                                      />
                                    ) : (
                                      <Package size={15} color="#64748b" />
                                    )}
                                  </div>
                                  <span style={{ fontWeight: 600 }}>
                                    {ing.name ||
                                      ing.ingredient_name ||
                                      matchedCat?.name ||
                                      `Ingredient #${ing.catalog_item_id || idx + 1}`}
                                  </span>
                                </div>
                              </td>
                              <td>
                                <span className="mkt-badge mkt-badge-slate">
                                  {displaySize}
                                </span>
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                ×{ing.suggested_quantity ?? ing.quantity ?? 1}
                              </td>
                              <td style={{ fontWeight: 700 }}>
                                {formatNaira(displayPrice)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="mkt-modal-footer">
              <div className="mkt-modal-footer-right">
                <button
                  type="button"
                  className="mkt-btn"
                  onClick={() => {
                    const target = inspectPack;
                    setInspectPack(null);
                    handleOpenEditMealPack(target);
                  }}
                >
                  <Edit2 size={13} />
                  Edit Meal Pack
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-primary"
                  onClick={() => setInspectPack(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 6: DELETE CONFIRMATION
          ════════════════════════════════════════════════════════════════ */}
      {deleteDialog && (
        <div
          className="mkt-modal-backdrop"
          onClick={() => !deleting && setDeleteDialog(null)}
        >
          <div
            className="mkt-modal mkt-modal-sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="mkt-modal-header">
              <h2 className="mkt-modal-title">Confirm Delete</h2>
              <button
                type="button"
                className="mkt-modal-close"
                onClick={() => !deleting && setDeleteDialog(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mkt-modal-body">
              <div className="mkt-receipt-box">
                <div className="mkt-receipt-kv-grid">
                  <div className="mkt-receipt-kv-item full-width">
                    <span className="mkt-receipt-kv-label">Selected Item</span>
                    <span className="mkt-receipt-kv-val">
                      {deleteDialog.record.name}
                    </span>
                  </div>
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.84rem",
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                {deleteDialog.type === "item"
                  ? "This will remove the ingredient from your catalog. Note: Ingredients currently used inside a meal pack cannot be deleted until removed from that pack."
                  : "Are you sure you want to permanently delete this item?"}
              </p>
            </div>

            <div className="mkt-modal-footer">
              <div className="mkt-modal-footer-right">
                <button
                  type="button"
                  className="mkt-btn"
                  onClick={() => setDeleteDialog(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="mkt-btn mkt-btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
