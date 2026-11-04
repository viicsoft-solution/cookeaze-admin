// src/pages/WarehouseDetailPage.js
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Link,
  useParams,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  Trash2,
  Package,
  Boxes,
  ShoppingBag,
  Search,
  Plus,
  CheckCircle2,
  AlertCircle,
  Navigation,
  X,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import {
  extractWarehouseArray,
  extractWarehouseObject,
  formatApiError,
  QUICK_COORD_PRESETS,
} from "./WarehousesPage";
import "./Warehouses.css";

const ORDER_STATUS_LABELS = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready for Pickup",
  AWAITING_RIDER: "Awaiting Rider",
  RIDER_ASSIGNED: "Rider Assigned",
  PICKED_UP: "Picked Up",
  OUT_FOR_DELIVERY: "Out for Delivery",
  DELIVERED_VERIFIED: "Delivered",
  COMPLETED: "Completed",
  COLLECTED: "Collected",
  AUTO_COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  DECLINED: "Declined",
  DISPUTED: "Disputed",
  REFUNDED: "Refunded",
};

function formatOrderStatusLabel(status) {
  const raw = String(status || "PENDING").toUpperCase();
  if (ORDER_STATUS_LABELS[raw]) return ORDER_STATUS_LABELS[raw];
  return raw
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatOrderDate(dateStr) {
  if (!dateStr) return "Date not set";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isGenericIngredientTitle(title) {
  if (!title) return true;
  return /^ingredient\s+order/i.test(String(title).trim());
}

function getOrderPrimaryHeading(order) {
  if (!order) return "Customer Order";
  const rawTitle = String(order.meal_title || "").trim();
  const items = Array.isArray(order.items) ? order.items : [];
  if (rawTitle && !isGenericIngredientTitle(rawTitle)) {
    return rawTitle;
  }
  if (items.length === 1) {
    return items[0].name || "1 Ingredient Item";
  }
  if (items.length === 2) {
    return `${items[0].name} & ${items[1].name}`;
  }
  if (items.length > 2) {
    return `${items[0].name} + ${items.length - 1} more items`;
  }
  return rawTitle || "Ingredient Order";
}

function formatCleanAddress(addr) {
  if (!addr) return "";
  const parts = String(addr)
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const deduped = [];
  const seenLower = new Set();
  for (const part of parts) {
    const key = part.toLowerCase();
    if (!seenLower.has(key)) {
      seenLower.add(key);
      deduped.push(part);
    }
  }
  return deduped.join(", ");
}

function formatCurrency(val) {
  const num = Number(val);
  if (Number.isNaN(num)) return val || "₦0.00";
  return `₦${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function WarehouseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const api = useMemo(() => getAxiosInstance(), []);

  const initialTab = searchParams.get("tab") || "stock";
  const [activeTab, setActiveTab] = useState(
    ["stock", "meal-packs", "orders"].includes(initialTab) ? initialTab : "stock"
  );

  // Sync tab with URL search param
  const handleSelectTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  // Warehouse Detail State (`GET /admin/warehouses/{id}/`)
  const [warehouse, setWarehouse] = useState(null);
  const [whLoading, setWhLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [togglingActive, setTogglingActive] = useState(false);

  // Edit Warehouse Modal State (`PATCH /admin/warehouses/{id}/`)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [locatingGps, setLocatingGps] = useState(false);

  // Delete Modal State (`DELETE /admin/warehouses/{id}/`)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 1. Catalog Item Stock State (`GET` & `PATCH /admin/warehouses/{id}/stock/`)
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // all | available | reserved | out
  const [stockEdits, setStockEdits] = useState({}); // { [catalog_item_id]: number }
  const [savingStockId, setSavingStockId] = useState(null);

  // Add/Update Catalog Item Stock Modal
  const [addStockOpen, setAddStockOpen] = useState(false);
  const [catalogList, setCatalogList] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [selectedCatalogId, setSelectedCatalogId] = useState("");
  const [newStockQty, setNewStockQty] = useState("0");
  const [addingStock, setAddingStock] = useState(false);
  const [addStockError, setAddStockError] = useState("");

  // 2. Direct Meal-Pack Stock State (`GET` & `PATCH /admin/warehouses/{id}/meal-pack-stock/`)
  const [mealPackStock, setMealPackStock] = useState([]);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpSearch, setMpSearch] = useState("");
  const [mpFilter, setMpFilter] = useState("all"); // all | available | reserved | zero
  const [mpEdits, setMpEdits] = useState({}); // { [meal_pack_id]: number }
  const [savingMpId, setSavingMpId] = useState(null);

  // Add/Update Meal-Pack Stock Modal
  const [addMpOpen, setAddMpOpen] = useState(false);
  const [allMealPacks, setAllMealPacks] = useState([]);
  const [allMealPacksLoading, setAllMealPacksLoading] = useState(false);
  const [mpCatalogSearch, setMpCatalogSearch] = useState("");
  const [selectedMealPackId, setSelectedMealPackId] = useState("");
  const [newMpQty, setNewMpQty] = useState("0");
  const [addingMp, setAddingMp] = useState(false);
  const [addMpError, setAddMpError] = useState("");

  // 3. Routed Orders State (`GET /admin/warehouses/{id}/orders/`)
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [orderStatusFilter, setOrderStatusFilter] = useState(""); // "" = all
  const [orderGroupFilter, setOrderGroupFilter] = useState("all"); // all | packing | transit | completed | cancelled
  const [orderSearch, setOrderSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);

  // 4. Ingredient & Meal Pack Preview Modal State
  const [previewTarget, setPreviewTarget] = useState(null);
  const [previewDetail, setPreviewDetail] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const previewDialogRef = useRef(null);

  const closePreviewModal = useCallback(() => {
    const dlg = previewDialogRef.current;
    if (dlg && dlg.open) {
      try {
        dlg.close();
      } catch {
        // ignore
      }
    }
    setPreviewTarget(null);
    setPreviewDetail(null);
    setPreviewError("");
    setPreviewLoading(false);
    setLightboxUrl(null);
  }, []);

  useEffect(() => {
    const dlg = previewDialogRef.current;
    if (!dlg || !previewTarget) return undefined;

    if (!dlg.open && typeof dlg.showModal === "function") {
      try {
        dlg.showModal();
      } catch {
        // fallback if already open
      }
    }

    // Fallback for browsers without native `<dialog closedby="any">` support
    if (
      typeof HTMLDialogElement !== "undefined" &&
      !("closedBy" in HTMLDialogElement.prototype)
    ) {
      const handleBackdropClick = (event) => {
        if (event.target !== dlg) return;
        const rect = dlg.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dlg.close();
      };
      dlg.addEventListener("click", handleBackdropClick);
      return () => dlg.removeEventListener("click", handleBackdropClick);
    }
    return undefined;
  }, [previewTarget]);

  // Track broken image URLs so failed images cleanly disappear instead of showing broken icons
  const [brokenImages, setBrokenImages] = useState({});
  const markImageBroken = useCallback((url) => {
    if (!url) return;
    setBrokenImages((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  }, []);

  // Fetch Ingredient Catalog (`GET /ingredients/catalog/`) so stock items resolve their real `image_url`
  const fetchCatalogList = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await api.get("/ingredients/catalog/", {
        params: { page: 1, page_size: 250 },
      });
      const firstPage = extractWarehouseArray(res.data);
      let combined = [...firstPage];

      const nextUrl =
        res.data?.pagination?.next ||
        res.data?.data?.next ||
        res.data?.next ||
        null;
      const totalPages =
        res.data?.pagination?.total_pages ||
        res.data?.data?.total_pages ||
        (nextUrl ? 3 : 1);

      if (totalPages > 1) {
        const pagePromises = [];
        for (let p = 2; p <= Math.min(totalPages, 6); p += 1) {
          pagePromises.push(
            api.get("/ingredients/catalog/", {
              params: { page: p, page_size: 250 },
            })
          );
        }
        const results = await Promise.allSettled(pagePromises);
        results.forEach((r) => {
          if (r.status === "fulfilled") {
            combined = combined.concat(extractWarehouseArray(r.value.data));
          }
        });
      }

      setCatalogList(combined);
    } catch {
      // Keep existing catalog list if request fails
    } finally {
      setCatalogLoading(false);
    }
  }, [api]);

  // Fetch Meal Packs Catalog (`GET /market/meal-packs/`) so meal-pack stock items resolve their `image_url`
  const fetchMealPacksCatalog = useCallback(async () => {
    setAllMealPacksLoading(true);
    try {
      const res = await api.get("/market/meal-packs/", {
        params: { page: 1, page_size: 250 },
      });
      setAllMealPacks(extractWarehouseArray(res.data));
    } catch {
      // Keep existing list if request fails
    } finally {
      setAllMealPacksLoading(false);
    }
  }, [api]);

  // Lookup maps for catalog item & meal pack images
  const { catalogById, catalogByName } = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    catalogList.forEach((c) => {
      if (!c || typeof c !== "object") return;
      const cid = Number(c.id ?? c.catalog_item_id);
      if (cid && !Number.isNaN(cid)) {
        byId.set(cid, c);
      }
      const nKey = String(c.name || "")
        .trim()
        .toLowerCase();
      if (nKey) {
        byName.set(nKey, c);
      }
    });
    return { catalogById: byId, catalogByName: byName };
  }, [catalogList]);

  const { mealPackById, mealPackByName } = useMemo(() => {
    const byId = new Map();
    const byName = new Map();
    allMealPacks.forEach((m) => {
      if (!m || typeof m !== "object") return;
      const mid = Number(m.id ?? m.meal_pack_id);
      if (mid && !Number.isNaN(mid)) {
        byId.set(mid, m);
      }
      const nKey = String(m.name || "")
        .trim()
        .toLowerCase();
      if (nKey) {
        byName.set(nKey, m);
      }
    });
    return { mealPackById: byId, mealPackByName: byName };
  }, [allMealPacks]);

  const isUsableImageUrl = useCallback(
    (url) => {
      if (!url || typeof url !== "string") return false;
      const trimmed = url.trim();
      if (!trimmed) return false;
      if (trimmed.includes("via.placeholder.com")) return false;
      if (brokenImages[trimmed]) return false;
      return true;
    },
    [brokenImages]
  );

  const getStockItemImageUrl = useCallback(
    (item) => {
      if (!item || typeof item !== "object") return null;
      const cid = Number(item.catalog_item_id ?? item.id);
      const nameKey = String(item.name || "")
        .trim()
        .toLowerCase();
      const catItem =
        (cid && catalogById.get(cid)) ||
        (nameKey && catalogByName.get(nameKey)) ||
        null;

      const candidate =
        item.image_url ||
        item.image ||
        item.photo_url ||
        item.thumbnail_url ||
        catItem?.image_url ||
        catItem?.image ||
        catItem?.photo_url ||
        catItem?.thumbnail_url ||
        null;

      return isUsableImageUrl(candidate) ? candidate.trim() : null;
    },
    [catalogById, catalogByName, isUsableImageUrl]
  );

  const getMealPackImageUrl = useCallback(
    (item) => {
      if (!item || typeof item !== "object") return null;
      const mid = Number(item.meal_pack_id ?? item.id);
      const nameKey = String(item.name || "")
        .trim()
        .toLowerCase();
      const packItem =
        (mid && mealPackById.get(mid)) ||
        (nameKey && mealPackByName.get(nameKey)) ||
        null;

      const candidate =
        item.image_url ||
        item.image ||
        packItem?.image_url ||
        packItem?.image ||
        null;

      return isUsableImageUrl(candidate) ? candidate.trim() : null;
    },
    [mealPackById, mealPackByName, isUsableImageUrl]
  );

  const getOrderImageUrl = useCallback(
    (order) => {
      if (!order || typeof order !== "object") return null;
      const direct =
        order.meal_image_url || order.image_url || order.image || null;
      if (isUsableImageUrl(direct)) return direct.trim();

      if (Array.isArray(order.items)) {
        for (const it of order.items) {
          const itemImg = getStockItemImageUrl(it);
          if (itemImg) return itemImg;
        }
      }
      return null;
    },
    [getStockItemImageUrl, isUsableImageUrl]
  );

  // Open Ingredient Preview Modal (`GET /ingredients/catalog/{id}/`)
  const openIngredientPreview = useCallback(
    async (itemOrId, parentMealPack = null) => {
      const rawObj = typeof itemOrId === "object" && itemOrId ? itemOrId : {};
      const nameKey = String(rawObj.name || "")
        .trim()
        .toLowerCase();
      const fallbackCat = nameKey ? catalogByName.get(nameKey) : null;
      const cid = Number(
        rawObj.catalog_item_id ??
          rawObj.id ??
          fallbackCat?.id ??
          (typeof itemOrId === "number" || typeof itemOrId === "string"
            ? itemOrId
            : 0)
      );

      if (!cid || Number.isNaN(cid)) return;

      const catItem = catalogById.get(cid) || fallbackCat || null;
      const stockRow =
        stockItems.find((s) => Number(s.catalog_item_id) === cid) || null;

      setStockEdits((prev) =>
        prev[cid] !== undefined
          ? prev
          : {
              ...prev,
              [cid]:
                stockRow?.quantity_in_stock !== undefined
                  ? Number(stockRow.quantity_in_stock)
                  : 0,
            }
      );

      const mergedInitial = {
        ...(catItem || {}),
        ...(stockRow || {}),
        ...rawObj,
        id: cid,
        catalog_item_id: cid,
        name:
          rawObj.name ||
          stockRow?.name ||
          catItem?.name ||
          `Ingredient #${cid}`,
      };

      setPreviewTarget({
        type: "ingredient",
        id: cid,
        name: mergedInitial.name,
        initialData: mergedInitial,
        parentMealPack,
      });
      setPreviewDetail(mergedInitial);
      setPreviewError("");
      setPreviewLoading(true);

      try {
        const params = {};
        if (
          warehouse &&
          warehouse.latitude !== undefined &&
          warehouse.longitude !== undefined
        ) {
          params.latitude = Number(warehouse.latitude);
          params.longitude = Number(warehouse.longitude);
        }
        const res = await api.get(`/ingredients/catalog/${cid}/`, { params });
        const detail = extractWarehouseObject(res.data);
        if (detail && typeof detail === "object") {
          setPreviewDetail((prev) => ({
            ...(prev || mergedInitial),
            ...detail,
          }));
        }
      } catch (err) {
        // Keep mergedInitial visible even if detail endpoint fails
        if (!catItem) {
          setPreviewError(
            formatApiError(err, "Could not load full catalog details.")
          );
        }
      } finally {
        setPreviewLoading(false);
      }
    },
    [api, catalogById, catalogByName, stockItems, warehouse]
  );

  // Open Meal Pack Preview Modal (`GET /market/meal-packs/{id}/`)
  const openMealPackPreview = useCallback(
    async (packOrId) => {
      const rawObj = typeof packOrId === "object" && packOrId ? packOrId : {};
      const nameKey = String(rawObj.name || "")
        .trim()
        .toLowerCase();
      const fallbackPack = nameKey ? mealPackByName.get(nameKey) : null;
      const mpid = Number(
        rawObj.meal_pack_id ??
          rawObj.id ??
          fallbackPack?.id ??
          (typeof packOrId === "number" || typeof packOrId === "string"
            ? packOrId
            : 0)
      );

      if (!mpid || Number.isNaN(mpid)) return;

      const catPack = mealPackById.get(mpid) || fallbackPack || null;
      const mpRow =
        mealPackStock.find((m) => Number(m.meal_pack_id) === mpid) || null;

      setMpEdits((prev) =>
        prev[mpid] !== undefined
          ? prev
          : {
              ...prev,
              [mpid]:
                mpRow?.quantity_on_hand !== undefined
                  ? Number(mpRow.quantity_on_hand)
                  : 0,
            }
      );

      const mergedInitial = {
        ...(catPack || {}),
        ...(mpRow || {}),
        ...rawObj,
        id: mpid,
        meal_pack_id: mpid,
        name:
          rawObj.name ||
          mpRow?.name ||
          catPack?.name ||
          `Meal Pack #${mpid}`,
      };

      setPreviewTarget({
        type: "meal-pack",
        id: mpid,
        name: mergedInitial.name,
        initialData: mergedInitial,
        parentMealPack: null,
      });
      setPreviewDetail(mergedInitial);
      setPreviewError("");
      setPreviewLoading(true);

      try {
        const params = {};
        if (
          warehouse &&
          warehouse.latitude !== undefined &&
          warehouse.longitude !== undefined
        ) {
          params.latitude = Number(warehouse.latitude);
          params.longitude = Number(warehouse.longitude);
        }
        const res = await api.get(`/market/meal-packs/${mpid}/`, { params });
        const detail = extractWarehouseObject(res.data);
        if (detail && typeof detail === "object") {
          setPreviewDetail((prev) => ({
            ...(prev || mergedInitial),
            ...detail,
          }));
        }
      } catch (err) {
        setPreviewError(
          formatApiError(err, "Could not load meal pack details.")
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [api, mealPackById, mealPackByName, mealPackStock, warehouse]
  );

  // Fetch Warehouse Detail
  const fetchWarehouseDetail = useCallback(async () => {
    setWhLoading(true);
    setError("");
    try {
      const res = await api.get(`/admin/warehouses/${id}/`);
      const data = extractWarehouseObject(res.data);
      setWarehouse(data);
    } catch (err) {
      setError(formatApiError(err, "Failed to load warehouse details."));
    } finally {
      setWhLoading(false);
    }
  }, [api, id]);

  // Fetch Catalog Stock
  const fetchStock = useCallback(async () => {
    setStockLoading(true);
    try {
      const res = await api.get(`/admin/warehouses/${id}/stock/`, {
        params: { page: 1, page_size: 250 },
      });
      const list = extractWarehouseArray(res.data);
      setStockItems(list);
      const initialEdits = {};
      list.forEach((item) => {
        if (item.catalog_item_id !== undefined) {
          initialEdits[item.catalog_item_id] =
            item.quantity_in_stock !== undefined ? Number(item.quantity_in_stock) : 0;
        }
      });
      setStockEdits(initialEdits);
    } catch (err) {
      setError(formatApiError(err, "Failed to load ingredient stock."));
    } finally {
      setStockLoading(false);
    }
  }, [api, id]);

  // Fetch Direct Meal-Pack Stock
  const fetchMealPackStock = useCallback(async () => {
    setMpLoading(true);
    try {
      const res = await api.get(`/admin/warehouses/${id}/meal-pack-stock/`, {
        params: { page: 1, page_size: 250 },
      });
      const list = extractWarehouseArray(res.data);
      setMealPackStock(list);
      const initialEdits = {};
      list.forEach((item) => {
        if (item.meal_pack_id !== undefined) {
          initialEdits[item.meal_pack_id] =
            item.quantity_on_hand !== undefined ? Number(item.quantity_on_hand) : 0;
        }
      });
      setMpEdits(initialEdits);
    } catch (err) {
      setError(formatApiError(err, "Failed to load meal-pack stock."));
    } finally {
      setMpLoading(false);
    }
  }, [api, id]);

  // Fetch Routed Orders
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const params = { page: 1, page_size: 100 };
      if (orderStatusFilter) {
        params.status = orderStatusFilter;
      }
      const res = await api.get(`/admin/warehouses/${id}/orders/`, { params });
      const list = extractWarehouseArray(res.data);
      setOrders(list);
    } catch (err) {
      setError(formatApiError(err, "Failed to load orders."));
    } finally {
      setOrdersLoading(false);
    }
  }, [api, id, orderStatusFilter]);

  useEffect(() => {
    fetchWarehouseDetail();
    fetchStock();
    fetchMealPackStock();
    fetchCatalogList();
    fetchMealPacksCatalog();
  }, [
    fetchWarehouseDetail,
    fetchStock,
    fetchMealPackStock,
    fetchCatalogList,
    fetchMealPacksCatalog,
  ]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleRefreshAll = () => {
    fetchWarehouseDetail();
    fetchStock();
    fetchMealPackStock();
    fetchCatalogList();
    fetchMealPacksCatalog();
    fetchOrders();
  };

  // Toggle Warehouse `is_active`
  const handleToggleActive = async () => {
    if (!warehouse) return;
    const nextActive = !(warehouse.is_active !== false);
    setTogglingActive(true);
    setError("");
    try {
      const payload = {
        name: warehouse.name,
        address: warehouse.address,
        latitude: Number(warehouse.latitude),
        longitude: Number(warehouse.longitude),
        contact_phone: warehouse.contact_phone || "",
        contact_email: warehouse.contact_email || "",
        is_active: nextActive,
      };
      const res = await api.patch(`/admin/warehouses/${id}/`, payload);
      const updated = extractWarehouseObject(res.data) || {
        ...warehouse,
        is_active: nextActive,
      };
      setWarehouse(updated);
      setNotice(
        `"${updated.name}" is now ${
          nextActive ? "active and accepting orders" : "paused"
        }.`
      );
    } catch (err) {
      setError(formatApiError(err, "Failed to update warehouse status."));
    } finally {
      setTogglingActive(false);
    }
  };

  // Open Edit Modal
  const openEditModal = () => {
    if (!warehouse) return;
    setFormName(warehouse.name || "");
    setFormAddress(warehouse.address || "");
    setFormLatitude(
      warehouse.latitude !== undefined && warehouse.latitude !== null
        ? String(warehouse.latitude)
        : ""
    );
    setFormLongitude(
      warehouse.longitude !== undefined && warehouse.longitude !== null
        ? String(warehouse.longitude)
        : ""
    );
    setFormPhone(warehouse.contact_phone || "");
    setFormEmail(warehouse.contact_email || "");
    setFormIsActive(warehouse.is_active !== false);
    setFormError("");
    setEditModalOpen(true);
  };

  const handleUseBrowserGps = () => {
    if (!navigator.geolocation) {
      setFormError("Geolocation is not supported by your browser.");
      return;
    }
    setLocatingGps(true);
    setFormError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormLatitude(pos.coords.latitude.toFixed(6));
        setFormLongitude(pos.coords.longitude.toFixed(6));
        setLocatingGps(false);
      },
      () => {
        setFormError(
          "Could not get your current GPS coordinates. Please enter them manually or choose a city preset."
        );
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleSaveWarehouseEdit = async (e) => {
    e.preventDefault();
    setFormError("");
    const latNum = parseFloat(formLatitude);
    const lngNum = parseFloat(formLongitude);

    if (!formName.trim() || !formAddress.trim()) {
      setFormError("Warehouse name and address are required.");
      return;
    }
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setFormError("Valid latitude and longitude numbers are required.");
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        address: formAddress.trim(),
        latitude: latNum,
        longitude: lngNum,
        contact_phone: formPhone.trim(),
        contact_email: formEmail.trim(),
        is_active: Boolean(formIsActive),
      };
      const res = await api.patch(`/admin/warehouses/${id}/`, payload);
      const updated = extractWarehouseObject(res.data) || {
        ...warehouse,
        ...payload,
      };
      setWarehouse(updated);
      setNotice("Warehouse information saved.");
      setEditModalOpen(false);
    } catch (err) {
      setFormError(formatApiError(err, "Failed to update warehouse."));
    } finally {
      setFormSaving(false);
    }
  };

  const handleHardDelete = async () => {
    setDeleteSubmitting(true);
    setError("");
    try {
      await api.delete(`/admin/warehouses/${id}/`);
      navigate("/warehouses", { replace: true });
    } catch (err) {
      setError(formatApiError(err, "Failed to delete warehouse."));
      setDeleteSubmitting(false);
    }
  };

  // --- STOCK TAB HANDLERS (`PATCH /admin/warehouses/{id}/stock/`) ---
  const handleSaveRowStock = async (catalogItemId) => {
    const rawVal = stockEdits[catalogItemId];
    const qty = Math.max(0, parseInt(rawVal, 10) || 0);
    setSavingStockId(catalogItemId);
    setError("");
    try {
      const res = await api.patch(`/admin/warehouses/${id}/stock/`, {
        catalog_item_id: Number(catalogItemId),
        quantity_in_stock: qty,
      });
      const updatedRow = extractWarehouseObject(res.data);
      const cidNum = Number(catalogItemId);
      const catInfo = catalogById.get(cidNum);

      setStockItems((prev) => {
        const exists = prev.some((row) => Number(row.catalog_item_id) === cidNum);
        if (exists) {
          return prev.map((row) =>
            Number(row.catalog_item_id) === cidNum
              ? {
                  ...row,
                  ...(updatedRow || {}),
                  quantity_in_stock:
                    updatedRow?.quantity_in_stock !== undefined
                      ? updatedRow.quantity_in_stock
                      : qty,
                }
              : row
          );
        }
        return [
          {
            catalog_item_id: cidNum,
            name: updatedRow?.name || catInfo?.name || `Ingredient #${cidNum}`,
            quantity_reserved: 0,
            ...(updatedRow || {}),
            quantity_in_stock:
              updatedRow?.quantity_in_stock !== undefined
                ? updatedRow.quantity_in_stock
                : qty,
          },
          ...prev,
        ];
      });

      setStockEdits((prev) => ({
        ...prev,
        [catalogItemId]:
          updatedRow?.quantity_in_stock !== undefined
            ? Number(updatedRow.quantity_in_stock)
            : qty,
      }));
      setNotice(
        `Saved stock for "${
          updatedRow?.name || catInfo?.name || `Item #${catalogItemId}`
        }" (${qty} in stock).`
      );
    } catch (err) {
      setError(formatApiError(err, "Failed to update item stock."));
    } finally {
      setSavingStockId(null);
    }
  };

  const openAddStockModal = async () => {
    setAddStockError("");
    setSelectedCatalogId("");
    setNewStockQty("0");
    setCatalogSearch("");
    setAddStockOpen(true);

    if (catalogList.length === 0) {
      setCatalogLoading(true);
      try {
        const res = await api.get("/ingredients/catalog/", {
          params: { page: 1, page_size: 200 },
        });
        setCatalogList(extractWarehouseArray(res.data));
      } catch {
        // Fallback: admin can still enter catalog_item_id manually
      } finally {
        setCatalogLoading(false);
      }
    }
  };

  const handleUpsertCatalogStock = async (e) => {
    e.preventDefault();
    setAddStockError("");
    const itemId = parseInt(selectedCatalogId, 10);
    const qty = parseInt(newStockQty, 10);

    if (Number.isNaN(itemId) || itemId <= 0) {
      setAddStockError("Please choose an ingredient from the list above.");
      return;
    }
    if (Number.isNaN(qty) || qty < 0) {
      setAddStockError("Stock quantity must be 0 or greater.");
      return;
    }

    setAddingStock(true);
    try {
      const res = await api.patch(`/admin/warehouses/${id}/stock/`, {
        catalog_item_id: itemId,
        quantity_in_stock: qty,
      });
      const saved = extractWarehouseObject(res.data);
      await fetchStock();
      setNotice(
        `Stock updated for ${saved?.name || `Item #${itemId}`} (${qty} units).`
      );
      setAddStockOpen(false);
    } catch (err) {
      setAddStockError(formatApiError(err, "Failed to save ingredient stock."));
    } finally {
      setAddingStock(false);
    }
  };

  // --- MEAL-PACK STOCK HANDLERS (`PATCH /admin/warehouses/{id}/meal-pack-stock/`) ---
  const handleSaveRowMealPackStock = async (mealPackId) => {
    const rawVal = mpEdits[mealPackId];
    const qty = Math.max(0, parseInt(rawVal, 10) || 0);
    setSavingMpId(mealPackId);
    setError("");
    try {
      const res = await api.patch(`/admin/warehouses/${id}/meal-pack-stock/`, {
        meal_pack_id: Number(mealPackId),
        quantity_on_hand: qty,
      });
      const updatedRow = extractWarehouseObject(res.data);
      const mpidNum = Number(mealPackId);
      const packInfo = mealPackById.get(mpidNum);

      setMealPackStock((prev) => {
        const exists = prev.some((row) => Number(row.meal_pack_id) === mpidNum);
        if (exists) {
          return prev.map((row) =>
            Number(row.meal_pack_id) === mpidNum
              ? {
                  ...row,
                  ...(updatedRow || {}),
                  quantity_on_hand:
                    updatedRow?.quantity_on_hand !== undefined
                      ? updatedRow.quantity_on_hand
                      : qty,
                }
              : row
          );
        }
        return [
          {
            meal_pack_id: mpidNum,
            name: updatedRow?.name || packInfo?.name || `Meal Pack #${mpidNum}`,
            image_url: updatedRow?.image_url || packInfo?.image_url || "",
            quantity_reserved: 0,
            ...(updatedRow || {}),
            quantity_on_hand:
              updatedRow?.quantity_on_hand !== undefined
                ? updatedRow.quantity_on_hand
                : qty,
          },
          ...prev,
        ];
      });

      setMpEdits((prev) => ({
        ...prev,
        [mealPackId]:
          updatedRow?.quantity_on_hand !== undefined
            ? Number(updatedRow.quantity_on_hand)
            : qty,
      }));
      setNotice(
        `Saved stock for "${
          updatedRow?.name || packInfo?.name || `Meal Pack #${mealPackId}`
        }" (${qty} on hand).`
      );
    } catch (err) {
      setError(formatApiError(err, "Failed to update meal-pack stock."));
    } finally {
      setSavingMpId(null);
    }
  };

  const openAddMealPackModal = async () => {
    setAddMpError("");
    setSelectedMealPackId("");
    setNewMpQty("0");
    setMpCatalogSearch("");
    setAddMpOpen(true);

    if (allMealPacks.length === 0) {
      setAllMealPacksLoading(true);
      try {
        const res = await api.get("/market/meal-packs/", {
          params: { page: 1, page_size: 200 },
        });
        setAllMealPacks(extractWarehouseArray(res.data));
      } catch {
        // Fallback: admin can still enter meal_pack_id manually
      } finally {
        setAllMealPacksLoading(false);
      }
    }
  };

  const handleUpsertMealPackStock = async (e) => {
    e.preventDefault();
    setAddMpError("");
    const packId = parseInt(selectedMealPackId, 10);
    const qty = parseInt(newMpQty, 10);

    if (Number.isNaN(packId) || packId <= 0) {
      setAddMpError("Please select a meal pack from the list above.");
      return;
    }
    if (Number.isNaN(qty) || qty < 0) {
      setAddMpError("Quantity must be 0 or greater.");
      return;
    }

    setAddingMp(true);
    try {
      const res = await api.patch(`/admin/warehouses/${id}/meal-pack-stock/`, {
        meal_pack_id: packId,
        quantity_on_hand: qty,
      });
      const saved = extractWarehouseObject(res.data);
      await fetchMealPackStock();
      setNotice(
        `Stock updated for ${saved?.name || `Meal Pack #${packId}`} (${qty} on hand).`
      );
      setAddMpOpen(false);
    } catch (err) {
      setAddMpError(formatApiError(err, "Failed to save meal-pack stock."));
    } finally {
      setAddingMp(false);
    }
  };

  // Filtered Stock Items
  const filteredStock = useMemo(() => {
    const q = stockSearch.trim().toLowerCase();
    return stockItems.filter((item) => {
      const inStock = Number(item.quantity_in_stock || 0);
      const reserved = Number(item.quantity_reserved || 0);
      const available =
        item.available_quantity !== undefined
          ? Number(item.available_quantity)
          : Math.max(0, inStock - reserved);

      if (stockFilter === "available" && available <= 0) return false;
      if (stockFilter === "reserved" && reserved <= 0) return false;
      if (stockFilter === "out" && available > 0) return false;

      if (!q) return true;
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.catalog_item_id || "").includes(q)
      );
    });
  }, [stockItems, stockSearch, stockFilter]);

  const stockStats = useMemo(() => {
    let totalInStock = 0;
    let totalReserved = 0;
    let totalAvailable = 0;
    let outOfStockCount = 0;

    stockItems.forEach((item) => {
      const inS = Number(item.quantity_in_stock || 0);
      const res = Number(item.quantity_reserved || 0);
      const avail =
        item.available_quantity !== undefined
          ? Number(item.available_quantity)
          : Math.max(0, inS - res);
      totalInStock += inS;
      totalReserved += res;
      totalAvailable += avail;
      if (avail <= 0) outOfStockCount += 1;
    });

    return {
      trackedItems: stockItems.length,
      totalInStock,
      totalReserved,
      totalAvailable,
      outOfStockCount,
    };
  }, [stockItems]);

  // Filtered Meal-Pack Stock
  const filteredMpStock = useMemo(() => {
    const q = mpSearch.trim().toLowerCase();
    return mealPackStock.filter((item) => {
      const onHand = Number(item.quantity_on_hand || 0);
      const reserved = Number(item.quantity_reserved || 0);
      const available =
        item.available_quantity !== undefined
          ? Number(item.available_quantity)
          : Math.max(0, onHand - reserved);

      if (mpFilter === "available" && available <= 0) return false;
      if (mpFilter === "reserved" && reserved <= 0) return false;
      if (mpFilter === "zero" && onHand > 0) return false;

      if (!q) return true;
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.meal_pack_id || "").includes(q)
      );
    });
  }, [mealPackStock, mpSearch, mpFilter]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    return orders.filter((o) => {
      const st = String(o.status || "").toUpperCase();
      if (orderGroupFilter === "packing") {
        if (
          !["PENDING", "ACCEPTED", "PREPARING", "READY", "AWAITING_RIDER"].includes(
            st
          )
        )
          return false;
      } else if (orderGroupFilter === "transit") {
        if (!["RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(st))
          return false;
      } else if (orderGroupFilter === "completed") {
        if (
          ![
            "DELIVERED_VERIFIED",
            "COMPLETED",
            "COLLECTED",
            "AUTO_COMPLETED",
          ].includes(st)
        )
          return false;
      } else if (orderGroupFilter === "cancelled") {
        if (!["CANCELLED", "DECLINED", "DISPUTED", "REFUNDED"].includes(st))
          return false;
      }

      if (!q) return true;
      const itemNames = Array.isArray(o.items)
        ? o.items.map((it) => String(it.name || "").toLowerCase()).join(" ")
        : "";
      return (
        String(o.order_number || "").toLowerCase().includes(q) ||
        String(o.id || "").includes(q) ||
        String(o.meal_title || "").toLowerCase().includes(q) ||
        itemNames.includes(q) ||
        String(o.buyer_name || "").toLowerCase().includes(q) ||
        String(o.buyer_phone || "").toLowerCase().includes(q) ||
        String(o.delivery_address || "").toLowerCase().includes(q) ||
        String(o.rider_name || "").toLowerCase().includes(q)
      );
    });
  }, [orders, orderSearch, orderGroupFilter]);

  const orderStats = useMemo(() => {
    const total = orders.length;
    const activePacking = orders.filter((o) =>
      ["PENDING", "ACCEPTED", "PREPARING", "READY", "AWAITING_RIDER"].includes(
        String(o.status || "").toUpperCase()
      )
    ).length;
    const inTransit = orders.filter((o) =>
      ["RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"].includes(
        String(o.status || "").toUpperCase()
      )
    ).length;
    const completedOrders = orders.filter((o) =>
      ["DELIVERED_VERIFIED", "COMPLETED", "COLLECTED", "AUTO_COMPLETED"].includes(
        String(o.status || "").toUpperCase()
      )
    );
    const completed = completedOrders.length;
    const cancelled = orders.filter((o) =>
      ["CANCELLED", "DECLINED", "DISPUTED", "REFUNDED"].includes(
        String(o.status || "").toUpperCase()
      )
    ).length;
    const completedRevenue = completedOrders.reduce(
      (sum, o) => sum + (Number(o.total_amount) || 0),
      0
    );
    return {
      total,
      activePacking,
      inTransit,
      completed,
      cancelled,
      completedRevenue,
    };
  }, [orders]);

  // Filtered catalog items in picker modal
  const filteredCatalogPicker = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    if (!q) return catalogList;
    return catalogList.filter(
      (c) =>
        String(c.name || "").toLowerCase().includes(q) ||
        String(c.id || "").includes(q) ||
        String(c.category_name || c.category || "")
          .toLowerCase()
          .includes(q)
    );
  }, [catalogList, catalogSearch]);

  // Filtered meal packs in picker modal
  const filteredMpPicker = useMemo(() => {
    const q = mpCatalogSearch.trim().toLowerCase();
    if (!q) return allMealPacks;
    return allMealPacks.filter(
      (m) =>
        String(m.name || "").toLowerCase().includes(q) ||
        String(m.id || "").includes(q)
    );
  }, [allMealPacks, mpCatalogSearch]);

  const isActive = warehouse ? warehouse.is_active !== false : true;
  const mapsUrl =
    warehouse &&
    warehouse.latitude !== undefined &&
    warehouse.longitude !== undefined
      ? `https://www.google.com/maps?q=${warehouse.latitude},${warehouse.longitude}`
      : null;

  return (
    <div className="wh-page">
      {/* Back Link */}
      <Link to="/warehouses" className="wh-breadcrumb">
        <ArrowLeft size={14} />
        All Warehouses
      </Link>

      {/* Alerts */}
      {error && (
        <div className="wh-alert error">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="wh-btn wh-btn-xs wh-btn-secondary"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="wh-alert success">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            className="wh-btn wh-btn-xs wh-btn-secondary"
            onClick={() => setNotice("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Compact Top Location Header Card */}
      <div className="wh-hub-header-card">
        <div className="wh-hub-top-row">
          <div className="wh-hub-identity">
            <div>
              <h1 className="wh-title" style={{ fontSize: "1.35rem" }}>
                {whLoading
                  ? "Loading warehouse..."
                  : warehouse?.name || "Warehouse"}
                {!whLoading && warehouse && (
                  <span
                    className={`wh-status-badge ${
                      isActive ? "active" : "inactive"
                    }`}
                  >
                    <span className="wh-status-dot" />
                    {isActive ? "Active" : "Paused"}
                  </span>
                )}
              </h1>
              <p className="wh-subtitle" style={{ marginTop: 2 }}>
                {isActive
                  ? "Receiving and fulfilling customer orders in this area"
                  : "Order routing is currently paused for this location"}
              </p>
            </div>
          </div>

          <div className="wh-header-actions">
            <button
              type="button"
              className="wh-btn wh-btn-secondary wh-btn-sm"
              onClick={handleRefreshAll}
            >
              Refresh
            </button>

            {warehouse && (
              <>
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary wh-btn-sm"
                  onClick={openEditModal}
                >
                  Edit Info
                </button>

                <button
                  type="button"
                  className="wh-btn wh-btn-secondary wh-btn-sm"
                  onClick={handleToggleActive}
                  disabled={togglingActive}
                >
                  {togglingActive
                    ? "Updating..."
                    : isActive
                    ? "Pause Orders"
                    : "Resume Orders"}
                </button>

                <button
                  type="button"
                  className="wh-btn wh-btn-danger-soft wh-btn-sm"
                  onClick={() => setDeleteModalOpen(true)}
                  title="Delete warehouse"
                >
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {!whLoading && warehouse && (
          <div className="wh-hub-meta-strip">
            <span className="wh-hub-meta-item">
              <strong style={{ color: "#1e293b", fontWeight: 600 }}>
                {warehouse.address || "No street address set"}
              </strong>
            </span>

            {warehouse.contact_phone && (
              <span className="wh-hub-meta-item">
                <span>{warehouse.contact_phone}</span>
              </span>
            )}

            {warehouse.contact_email && (
              <span className="wh-hub-meta-item">
                <span>{warehouse.contact_email}</span>
              </span>
            )}

            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="wh-map-link"
              >
                <span>View on Map</span>
                <ExternalLink size={10} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Cohesive Workspace Card (Tabs + Toolbar + Table) */}
      <div className="wh-workspace-card">
        {/* Clean Minimal Tabs */}
        <div className="wh-workspace-tabs-bar">
          <div className="wh-tabs">
            <button
              type="button"
              className={`wh-tab${activeTab === "stock" ? " active" : ""}`}
              onClick={() => handleSelectTab("stock")}
            >
              Ingredients Stock
              <span className="wh-tab-count">({stockItems.length})</span>
            </button>

            <button
              type="button"
              className={`wh-tab${activeTab === "meal-packs" ? " active" : ""}`}
              onClick={() => handleSelectTab("meal-packs")}
            >
              Meal Packs Stock
              <span className="wh-tab-count">({mealPackStock.length})</span>
            </button>

            <button
              type="button"
              className={`wh-tab${activeTab === "orders" ? " active" : ""}`}
              onClick={() => handleSelectTab("orders")}
            >
              Customer Orders
              <span className="wh-tab-count">({orders.length})</span>
            </button>
          </div>
        </div>

        {/* ===================================================================
            TAB 1: INGREDIENTS STOCK
        =================================================================== */}
        {activeTab === "stock" && (
          <div>
            <div className="wh-workspace-toolbar">
              <div className="wh-toolbar-left">
                <div className="wh-search-wrap" style={{ minWidth: 250 }}>
                  <Search size={15} className="wh-search-icon" />
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Search ingredient..."
                    value={stockSearch}
                    onChange={(e) => setStockSearch(e.target.value)}
                  />
                  {stockSearch && (
                    <button
                      type="button"
                      className="wh-search-clear"
                      onClick={() => setStockSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="wh-filter-pills">
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      stockFilter === "all" ? " active" : ""
                    }`}
                    onClick={() => setStockFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      stockFilter === "available" ? " active" : ""
                    }`}
                    onClick={() => setStockFilter("available")}
                  >
                    In Stock
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      stockFilter === "reserved" ? " active" : ""
                    }`}
                    onClick={() => setStockFilter("reserved")}
                  >
                    Reserved
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      stockFilter === "out" ? " active" : ""
                    }`}
                    onClick={() => setStockFilter("out")}
                  >
                    Out of Stock
                    {stockStats.outOfStockCount > 0
                      ? ` (${stockStats.outOfStockCount})`
                      : ""}
                  </button>
                </div>
              </div>

              <div className="wh-toolbar-right">
                <button
                  type="button"
                  className="wh-btn wh-btn-primary wh-btn-sm"
                  onClick={openAddStockModal}
                >
                  Add Ingredient Stock
                </button>
              </div>
            </div>

            {stockLoading ? (
              <div className="wh-table-scroll">
                <table className="wh-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Total Stock</th>
                      <th>Reserved for Orders</th>
                      <th>Available</th>
                      <th>Update Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="wh-item-cell">
                            <div
                              className="wh-shimmer"
                              style={{ width: 34, height: 34, borderRadius: 8 }}
                            />
                            <div
                              className="wh-shimmer"
                              style={{ width: 150, height: 14 }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 45, height: 15 }} />
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 45, height: 15 }} />
                        </td>
                        <td>
                          <div
                            className="wh-shimmer"
                            style={{ width: 70, height: 22, borderRadius: 999 }}
                          />
                        </td>
                        <td>
                          <div
                            className="wh-shimmer"
                            style={{ width: 190, height: 28, borderRadius: 7 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredStock.length === 0 ? (
              <div className="wh-empty">
                <div className="wh-empty-icon">
                  <Package size={22} />
                </div>
                <h3>No ingredient stock found</h3>
                <p>
                  {stockSearch || stockFilter !== "all"
                    ? "No ingredients match your current filter."
                    : "Add ingredients from your catalog to track how many units are stored at this warehouse."}
                </p>
                <button
                  type="button"
                  className="wh-btn wh-btn-primary wh-btn-sm"
                  onClick={openAddStockModal}
                  style={{ marginTop: 6 }}
                >
                  <Plus size={14} />
                  Add Ingredient Stock
                </button>
              </div>
            ) : (
              <div className="wh-table-scroll">
                <table className="wh-table wh-stock-table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Total Stock</th>
                      <th>Reserved for Orders</th>
                      <th>Available to Buy</th>
                      <th>Update Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStock.map((item) => {
                      const cid = item.catalog_item_id;
                      const inStock = Number(item.quantity_in_stock ?? 0);
                      const reserved = Number(item.quantity_reserved ?? 0);
                      const available =
                        item.available_quantity !== undefined
                          ? Number(item.available_quantity)
                          : Math.max(0, inStock - reserved);
                      const editVal =
                        stockEdits[cid] !== undefined ? stockEdits[cid] : inStock;
                      const isDirty = Number(editVal) !== inStock;
                      const itemImageUrl = getStockItemImageUrl(item);
                      const catEntry = catalogById.get(Number(cid));
                      const catLabel =
                        catEntry?.category_name || catEntry?.category || null;
                      const variantCount = Array.isArray(catEntry?.variants)
                        ? catEntry.variants.length
                        : 0;

                      return (
                        <tr
                          key={cid}
                          className="wh-order-row"
                          onClick={() => openIngredientPreview(item)}
                        >
                          <td className="wh-stock-item-td">
                            <button
                              type="button"
                              className="wh-item-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                openIngredientPreview(item);
                              }}
                              title="Click to view ingredient details"
                            >
                              {itemImageUrl && (
                                <img
                                  src={itemImageUrl}
                                  alt={item.name || `Ingredient #${cid}`}
                                  className="wh-item-thumb"
                                  onError={() => markImageBroken(itemImageUrl)}
                                />
                              )}
                              <div>
                                <div className="wh-item-title">
                                  {item.name || `Ingredient #${cid}`}
                                </div>
                                <div className="wh-item-sub">
                                  {catLabel && <span>{catLabel}</span>}
                                  {catLabel && variantCount > 0 && <span>·</span>}
                                  {variantCount > 0 ? (
                                    <span>
                                      {variantCount}{" "}
                                      {variantCount === 1 ? "size" : "sizes"}
                                    </span>
                                  ) : (
                                    !catLabel && <span>View details</span>
                                  )}
                                </div>
                              </div>
                            </button>
                          </td>

                          <td
                            data-label="Total Stock"
                            style={{ fontWeight: 700 }}
                          >
                            {inStock}
                          </td>

                          <td
                            data-label="Reserved"
                            style={{
                              color: reserved > 0 ? "#b45309" : "#64748b",
                              fontWeight: reserved > 0 ? 600 : 400,
                            }}
                          >
                            {reserved}
                          </td>

                          <td data-label="Available">
                            <span
                              className={`wh-avail-pill ${
                                available > 0 ? "in" : "out"
                              }`}
                            >
                              {available > 0
                                ? `${available} available`
                                : "Out of stock"}
                            </span>
                          </td>

                          <td
                            data-label="Update Quantity"
                            className="wh-stock-action-td"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="wh-stock-editor">
                              <button
                                type="button"
                                className="wh-step-btn"
                                onClick={() =>
                                  setStockEdits((prev) => ({
                                    ...prev,
                                    [cid]: Math.max(0, Number(editVal || 0) - 1),
                                  }))
                                }
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                className="wh-stock-input"
                                value={editVal}
                                onChange={(e) =>
                                  setStockEdits((prev) => ({
                                    ...prev,
                                    [cid]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="wh-step-btn"
                                onClick={() =>
                                  setStockEdits((prev) => ({
                                    ...prev,
                                    [cid]: Math.max(0, Number(editVal || 0) + 1),
                                  }))
                                }
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className={`wh-btn wh-btn-sm ${
                                  isDirty ? "wh-btn-brand" : "wh-btn-secondary"
                                }`}
                                onClick={() => handleSaveRowStock(cid)}
                                disabled={savingStockId === cid}
                              >
                                {savingStockId === cid ? "Saving..." : "Save"}
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
          </div>
        )}

        {/* ===================================================================
            TAB 2: MEAL PACKS STOCK
        =================================================================== */}
        {activeTab === "meal-packs" && (
          <div>
            <div className="wh-workspace-toolbar">
              <div className="wh-toolbar-left">
                <div className="wh-search-wrap" style={{ minWidth: 250 }}>
                  <Search size={15} className="wh-search-icon" />
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Search meal pack..."
                    value={mpSearch}
                    onChange={(e) => setMpSearch(e.target.value)}
                  />
                  {mpSearch && (
                    <button
                      type="button"
                      className="wh-search-clear"
                      onClick={() => setMpSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="wh-filter-pills">
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      mpFilter === "all" ? " active" : ""
                    }`}
                    onClick={() => setMpFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      mpFilter === "available" ? " active" : ""
                    }`}
                    onClick={() => setMpFilter("available")}
                  >
                    Available
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      mpFilter === "reserved" ? " active" : ""
                    }`}
                    onClick={() => setMpFilter("reserved")}
                  >
                    Reserved
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      mpFilter === "zero" ? " active" : ""
                    }`}
                    onClick={() => setMpFilter("zero")}
                  >
                    Out of Stock
                  </button>
                </div>
              </div>

              <div className="wh-toolbar-right">
                <button
                  type="button"
                  className="wh-btn wh-btn-primary wh-btn-sm"
                  onClick={openAddMealPackModal}
                >
                  Add Meal Pack Stock
                </button>
              </div>
            </div>

            {mpLoading ? (
              <div className="wh-table-scroll">
                <table className="wh-table">
                  <thead>
                    <tr>
                      <th>Meal Pack</th>
                      <th>On Hand</th>
                      <th>Reserved</th>
                      <th>Available</th>
                      <th>Update Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="wh-item-cell">
                            <div
                              className="wh-shimmer"
                              style={{ width: 38, height: 38, borderRadius: 8 }}
                            />
                            <div
                              className="wh-shimmer"
                              style={{ width: 160, height: 14 }}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 45, height: 15 }} />
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 45, height: 15 }} />
                        </td>
                        <td>
                          <div
                            className="wh-shimmer"
                            style={{ width: 70, height: 22, borderRadius: 999 }}
                          />
                        </td>
                        <td>
                          <div
                            className="wh-shimmer"
                            style={{ width: 190, height: 28, borderRadius: 7 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredMpStock.length === 0 ? (
              <div className="wh-empty">
                <div className="wh-empty-icon">
                  <Boxes size={22} />
                </div>
                <h3>No pre-packed meal packs tracked yet</h3>
                <p>
                  Unlisted packs use Ingredients Stock automatically.
                </p>
                <button
                  type="button"
                  className="wh-btn wh-btn-primary wh-btn-sm"
                  onClick={openAddMealPackModal}
                  style={{ marginTop: 6 }}
                >
                  <Plus size={14} />
                  Add Meal Pack Stock
                </button>
              </div>
            ) : (
              <div className="wh-table-scroll">
                <table className="wh-table wh-stock-table">
                  <thead>
                    <tr>
                      <th>Meal Pack</th>
                      <th>On Hand</th>
                      <th>Reserved for Orders</th>
                      <th>Available</th>
                      <th>Update Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMpStock.map((item) => {
                      const mpid = item.meal_pack_id;
                      const onHand = Number(item.quantity_on_hand ?? 0);
                      const reserved = Number(item.quantity_reserved ?? 0);
                      const available =
                        item.available_quantity !== undefined
                          ? Number(item.available_quantity)
                          : Math.max(0, onHand - reserved);
                      const editVal =
                        mpEdits[mpid] !== undefined ? mpEdits[mpid] : onHand;
                      const isDirty = Number(editVal) !== onHand;
                      const mpImageUrl = getMealPackImageUrl(item);
                      const packCatalog = mealPackById.get(Number(mpid));
                      const ingCount =
                        packCatalog?.ingredient_count ?? item.ingredient_count;
                      const estPrice =
                        packCatalog?.estimated_price ??
                        packCatalog?.estimated_cost ??
                        item.estimated_price ??
                        null;

                      return (
                        <tr
                          key={mpid}
                          className="wh-order-row"
                          onClick={() => openMealPackPreview(item)}
                        >
                          <td className="wh-stock-item-td">
                            <button
                              type="button"
                              className="wh-item-trigger"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMealPackPreview(item);
                              }}
                              title="Click to view meal pack details & ingredients"
                            >
                              {mpImageUrl && (
                                <img
                                  src={mpImageUrl}
                                  alt={item.name || `Meal Pack #${mpid}`}
                                  className="wh-item-thumb"
                                  onError={() => markImageBroken(mpImageUrl)}
                                />
                              )}
                              <div>
                                <div className="wh-item-title">
                                  {item.name || `Meal Pack #${mpid}`}
                                </div>
                                <div className="wh-item-sub">
                                  {ingCount !== undefined ? (
                                    <span>
                                      {ingCount}{" "}
                                      {Number(ingCount) === 1
                                        ? "ingredient"
                                        : "ingredients"}
                                    </span>
                                  ) : (
                                    <span>View pack ingredients</span>
                                  )}
                                  {estPrice !== null &&
                                    estPrice !== undefined && (
                                      <span>· {formatCurrency(estPrice)}</span>
                                    )}
                                </div>
                              </div>
                            </button>
                          </td>

                          <td data-label="On Hand" style={{ fontWeight: 700 }}>
                            {onHand}
                          </td>

                          <td
                            data-label="Reserved"
                            style={{
                              color: reserved > 0 ? "#b45309" : "#64748b",
                              fontWeight: reserved > 0 ? 600 : 400,
                            }}
                          >
                            {reserved}
                          </td>

                          <td data-label="Available">
                            <span
                              className={`wh-avail-pill ${
                                available > 0 ? "in" : "out"
                              }`}
                            >
                              {available > 0
                                ? `${available} available`
                                : "Out of stock"}
                            </span>
                          </td>

                          <td
                            data-label="Update Quantity"
                            className="wh-stock-action-td"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="wh-stock-editor">
                              <button
                                type="button"
                                className="wh-step-btn"
                                onClick={() =>
                                  setMpEdits((prev) => ({
                                    ...prev,
                                    [mpid]: Math.max(0, Number(editVal || 0) - 1),
                                  }))
                                }
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                className="wh-stock-input"
                                value={editVal}
                                onChange={(e) =>
                                  setMpEdits((prev) => ({
                                    ...prev,
                                    [mpid]: e.target.value,
                                  }))
                                }
                              />
                              <button
                                type="button"
                                className="wh-step-btn"
                                onClick={() =>
                                  setMpEdits((prev) => ({
                                    ...prev,
                                    [mpid]: Math.max(0, Number(editVal || 0) + 1),
                                  }))
                                }
                              >
                                +
                              </button>
                              <button
                                type="button"
                                className={`wh-btn wh-btn-sm ${
                                  isDirty ? "wh-btn-brand" : "wh-btn-secondary"
                                }`}
                                onClick={() => handleSaveRowMealPackStock(mpid)}
                                disabled={savingMpId === mpid}
                              >
                                {savingMpId === mpid ? "Saving..." : "Save"}
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
          </div>
        )}

        {/* ===================================================================
            TAB 3: CUSTOMER ORDERS (`GET /admin/warehouses/{id}/orders/`)
        =================================================================== */}
        {activeTab === "orders" && (
          <div>
            <div className="wh-workspace-toolbar">
              <div className="wh-toolbar-left">
                <div className="wh-search-wrap" style={{ minWidth: 260 }}>
                  <Search size={15} className="wh-search-icon" />
                  <input
                    type="text"
                    className="wh-search-input"
                    placeholder="Search order #, item, customer, or rider..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                  />
                  {orderSearch && (
                    <button
                      type="button"
                      className="wh-search-clear"
                      onClick={() => setOrderSearch("")}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="wh-filter-pills">
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      orderGroupFilter === "all" ? " active" : ""
                    }`}
                    onClick={() => setOrderGroupFilter("all")}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      orderGroupFilter === "packing" ? " active" : ""
                    }`}
                    onClick={() => setOrderGroupFilter("packing")}
                  >
                    Pending
                    {orderStats.activePacking > 0
                      ? ` (${orderStats.activePacking})`
                      : ""}
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      orderGroupFilter === "transit" ? " active" : ""
                    }`}
                    onClick={() => setOrderGroupFilter("transit")}
                  >
                    In Transit
                    {orderStats.inTransit > 0
                      ? ` (${orderStats.inTransit})`
                      : ""}
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      orderGroupFilter === "completed" ? " active" : ""
                    }`}
                    onClick={() => setOrderGroupFilter("completed")}
                  >
                    Completed
                    {orderStats.completed > 0
                      ? ` (${orderStats.completed})`
                      : ""}
                  </button>
                  <button
                    type="button"
                    className={`wh-filter-pill${
                      orderGroupFilter === "cancelled" ? " active" : ""
                    }`}
                    onClick={() => setOrderGroupFilter("cancelled")}
                  >
                    Cancelled
                    {orderStats.cancelled > 0
                      ? ` (${orderStats.cancelled})`
                      : ""}
                  </button>
                </div>
              </div>

              <div className="wh-toolbar-right">
                <span className="wh-orders-count-note">
                  {filteredOrders.length}{" "}
                  {filteredOrders.length === 1 ? "order" : "orders"}
                </span>
              </div>
            </div>

            {ordersLoading ? (
              <div className="wh-table-scroll">
                <table className="wh-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Ordered Items</th>
                      <th>Customer &amp; Delivery</th>
                      <th>Rider</th>
                      <th>Total</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="wh-shimmer" style={{ width: 90, height: 15 }} />
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 150, height: 15 }} />
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 170, height: 15 }} />
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 100, height: 15 }} />
                        </td>
                        <td>
                          <div className="wh-shimmer" style={{ width: 80, height: 15 }} />
                        </td>
                        <td>
                          <div
                            className="wh-shimmer"
                            style={{ width: 80, height: 22, borderRadius: 999 }}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="wh-shimmer"
                            style={{
                              width: 80,
                              height: 28,
                              borderRadius: 7,
                              marginLeft: "auto",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="wh-empty">
                <div className="wh-empty-icon">
                  <ShoppingBag size={22} />
                </div>
                <h3>No orders found</h3>
                <p>
                  {orderStatusFilter || orderSearch || orderGroupFilter !== "all"
                    ? "No orders matched your current filter."
                    : "Customer orders assigned to this warehouse will appear here automatically."}
                </p>
                {(orderStatusFilter ||
                  orderSearch ||
                  orderGroupFilter !== "all") && (
                  <button
                    type="button"
                    className="wh-btn wh-btn-secondary wh-btn-sm"
                    onClick={() => {
                      setOrderStatusFilter("");
                      setOrderGroupFilter("all");
                      setOrderSearch("");
                    }}
                    style={{ marginTop: 6 }}
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Desktop Customer Orders Table */}
                <div className="wh-table-scroll wh-orders-desktop-wrap">
                  <table className="wh-table wh-orders-table">
                    <thead>
                      <tr>
                        <th style={{ whiteSpace: "nowrap" }}>Order</th>
                        <th>Ordered Items</th>
                        <th>Customer &amp; Delivery</th>
                        <th>Rider</th>
                        <th>Total</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => {
                        const stClass = String(
                          order.status || "PENDING"
                        ).toLowerCase();
                        const items = Array.isArray(order.items)
                          ? order.items
                          : [];
                        const itemCount = items.length;
                        const orderImageUrl = getOrderImageUrl(order);
                        const primaryHeading = getOrderPrimaryHeading(order);
                        const namedMealPack =
                          order.meal_title &&
                          !isGenericIngredientTitle(order.meal_title)
                            ? order.meal_title
                            : null;
                        const cleanAddress = formatCleanAddress(
                          order.delivery_address
                        );
                        const qtyLabel =
                          namedMealPack && items.length > 0
                            ? `${itemCount} ${
                                itemCount === 1 ? "item" : "items"
                              } in pack`
                            : items.length === 1 && items[0].size
                            ? `${items[0].size}${
                                items[0].quantity > 1
                                  ? ` × ${items[0].quantity}`
                                  : ""
                              }`
                            : itemCount > 0
                            ? `${itemCount} ${
                                itemCount === 1 ? "item" : "items"
                              }`
                            : "Tap to view items";

                        return (
                          <tr
                            key={order.id}
                            className="wh-order-row"
                            onClick={() => setSelectedOrder(order)}
                          >
                            <td className="wh-order-id-cell">
                              <div className="wh-order-id-text">
                                {order.order_number || `#${order.id}`}
                              </div>
                              {order.created_at && (
                                <div className="wh-order-subtext">
                                  {formatOrderDate(order.created_at)}
                                </div>
                              )}
                            </td>

                            <td className="wh-order-primary-td">
                              <div className="wh-item-cell">
                                {orderImageUrl && (
                                  <img
                                    src={orderImageUrl}
                                    alt={primaryHeading}
                                    className="wh-item-thumb"
                                    onError={() => markImageBroken(orderImageUrl)}
                                  />
                                )}
                                <div style={{ minWidth: 0 }}>
                                  <div className="wh-order-main-text">
                                    {primaryHeading}
                                  </div>
                                  <div className="wh-order-subtext">
                                    {qtyLabel}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="wh-order-customer-line">
                                <span className="wh-order-main-text">
                                  {order.buyer_name || "Customer"}
                                </span>
                                {order.buyer_phone && (
                                  <span className="wh-order-phone-tag">
                                    · {order.buyer_phone}
                                  </span>
                                )}
                              </div>
                              {cleanAddress && (
                                <div
                                  className="wh-order-address-line"
                                  title={order.delivery_address}
                                >
                                  {cleanAddress}
                                </div>
                              )}
                            </td>

                            <td>
                              {order.rider_name ? (
                                <div>
                                  <div className="wh-order-main-text">
                                    {order.rider_name}
                                  </div>
                                  {order.rider_phone && (
                                    <div className="wh-order-subtext">
                                      {order.rider_phone}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="wh-order-unassigned">
                                  Unassigned
                                </span>
                              )}
                            </td>

                            <td>
                              <span className="wh-order-total-text">
                                {formatCurrency(order.total_amount)}
                              </span>
                            </td>

                            <td>
                              <span className={`wh-order-status ${stClass}`}>
                                {formatOrderStatusLabel(order.status)}
                              </span>
                            </td>

                            <td
                              style={{ textAlign: "right" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className="wh-btn wh-btn-secondary wh-btn-sm"
                                onClick={() => setSelectedOrder(order)}
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile & Tablet Responsive Order Cards (Zero Horizontal Scroll) */}
                <div className="wh-orders-mobile-cards">
                  {filteredOrders.map((order) => {
                    const stClass = String(
                      order.status || "PENDING"
                    ).toLowerCase();
                    const items = Array.isArray(order.items) ? order.items : [];
                    const itemCount = items.length;
                    const orderImageUrl = getOrderImageUrl(order);
                    const primaryHeading = getOrderPrimaryHeading(order);
                    const namedMealPack =
                      order.meal_title &&
                      !isGenericIngredientTitle(order.meal_title)
                        ? order.meal_title
                        : null;
                    const cleanAddress = formatCleanAddress(
                      order.delivery_address
                    );
                    const qtyLabel =
                      namedMealPack && items.length > 0
                        ? `${itemCount} ${
                            itemCount === 1 ? "item" : "items"
                          } in pack`
                        : items.length === 1 && items[0].size
                        ? `${items[0].size}${
                            items[0].quantity > 1
                              ? ` × ${items[0].quantity}`
                              : ""
                          }`
                        : itemCount > 0
                        ? `${itemCount} ${itemCount === 1 ? "item" : "items"}`
                        : null;

                    return (
                      <div
                        key={order.id}
                        className="wh-order-mcard"
                        onClick={() => setSelectedOrder(order)}
                      >
                        <div className="wh-order-mcard-top">
                          <div className="wh-order-mcard-id-group">
                            <span className="wh-order-code">
                              {order.order_number || `#${order.id}`}
                            </span>
                            {order.created_at && (
                              <span className="wh-order-subtext">
                                · {formatOrderDate(order.created_at)}
                              </span>
                            )}
                          </div>
                          <span className={`wh-order-status ${stClass}`}>
                            {formatOrderStatusLabel(order.status)}
                          </span>
                        </div>

                        <div className="wh-order-mcard-item-row">
                          <div className="wh-item-cell" style={{ minWidth: 0 }}>
                            {orderImageUrl && (
                              <img
                                src={orderImageUrl}
                                alt={primaryHeading}
                                className="wh-item-thumb"
                                onError={() => markImageBroken(orderImageUrl)}
                              />
                            )}
                            <div style={{ minWidth: 0 }}>
                              <div className="wh-order-main-text">
                                {primaryHeading}
                              </div>
                              {qtyLabel && (
                                <div className="wh-order-subtext">
                                  {qtyLabel}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="wh-order-total-text">
                            {formatCurrency(order.total_amount)}
                          </div>
                        </div>

                        <div className="wh-order-mcard-meta">
                          <div className="wh-order-mcard-meta-row">
                            <span className="wh-order-mcard-label">
                              Customer
                            </span>
                            <span className="wh-order-mcard-val">
                              {order.buyer_name || "Customer"}
                              {order.buyer_phone
                                ? ` · ${order.buyer_phone}`
                                : ""}
                            </span>
                          </div>
                          {cleanAddress && (
                            <div className="wh-order-mcard-meta-row">
                              <span className="wh-order-mcard-label">
                                Address
                              </span>
                              <span className="wh-order-mcard-val">
                                {cleanAddress}
                              </span>
                            </div>
                          )}
                          <div className="wh-order-mcard-meta-row">
                            <span className="wh-order-mcard-label">Rider</span>
                            <span className="wh-order-mcard-val">
                              {order.rider_name
                                ? `${order.rider_name}${
                                    order.rider_phone
                                      ? ` · ${order.rider_phone}`
                                      : ""
                                  }`
                                : "Unassigned"}
                            </span>
                          </div>
                        </div>

                        <div
                          className="wh-order-mcard-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="wh-btn wh-btn-secondary wh-btn-sm"
                            style={{ width: "100%", justifyContent: "center" }}
                            onClick={() => setSelectedOrder(order)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================
          MODAL 1: ADD / UPDATE INGREDIENT STOCK
      =================================================================== */}
      {addStockOpen && (
        <div
          className="wh-modal-backdrop"
          onClick={() => !addingStock && setAddStockOpen(false)}
        >
          <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Add or Update Ingredient Stock</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => !addingStock && setAddStockOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpsertCatalogStock}>
              <div className="wh-modal-body">
                {addStockError && (
                  <div className="wh-alert error" style={{ marginBottom: 0 }}>
                    <span>{addStockError}</span>
                  </div>
                )}

                <div className="wh-form-group">
                  <label className="wh-label">
                    <span>1. Choose an Ingredient</span>
                    <span className="wh-help">
                      {catalogLoading
                        ? "Loading catalog..."
                        : `${catalogList.length} items available`}
                    </span>
                  </label>
                  <input
                    type="text"
                    className="wh-input"
                    placeholder="Search ingredient by name..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                  />

                  {filteredCatalogPicker.length > 0 && (
                    <div className="wh-picker-list" style={{ marginTop: 4 }}>
                      {filteredCatalogPicker.slice(0, 60).map((catItem) => {
                        const isSel =
                          String(selectedCatalogId) === String(catItem.id);
                        const catImg = getStockItemImageUrl(catItem);
                        return (
                          <button
                            key={catItem.id}
                            type="button"
                            className={`wh-picker-item${isSel ? " selected" : ""}`}
                            onClick={() => {
                              setSelectedCatalogId(String(catItem.id));
                              const existing = stockItems.find(
                                (s) =>
                                  Number(s.catalog_item_id) === Number(catItem.id)
                              );
                              if (existing) {
                                setNewStockQty(
                                  String(existing.quantity_in_stock ?? 0)
                                );
                              }
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              {catImg && (
                                <img
                                  src={catImg}
                                  alt={catItem.name}
                                  className="wh-item-thumb-sm"
                                  onError={() => markImageBroken(catImg)}
                                />
                              )}
                              <div>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    fontSize: "0.83rem",
                                    color: "#0f172a",
                                  }}
                                >
                                  {catItem.name}
                                </div>
                                {(catItem.category_name || catItem.category) && (
                                  <div
                                    style={{
                                      fontSize: "0.72rem",
                                      color: "#64748b",
                                    }}
                                  >
                                    {catItem.category_name || catItem.category}
                                  </div>
                                )}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                color: isSel ? "#0f172a" : "#64748b",
                              }}
                            >
                              {isSel ? "Selected ✓" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="wh-form-grid">
                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>
                        Ingredient ID <span className="req">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="wh-input"
                      placeholder="Selected automatically"
                      value={selectedCatalogId}
                      onChange={(e) => setSelectedCatalogId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>
                        Quantity in Stock <span className="req">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="wh-input"
                      placeholder="e.g. 50"
                      value={newStockQty}
                      onChange={(e) => setNewStockQty(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setAddStockOpen(false)}
                  disabled={addingStock}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={addingStock}
                >
                  {addingStock ? "Saving..." : "Save Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: ADD / UPDATE MEAL PACK STOCK
      =================================================================== */}
      {addMpOpen && (
        <div
          className="wh-modal-backdrop"
          onClick={() => !addingMp && setAddMpOpen(false)}
        >
          <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Add or Update Meal Pack Stock</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => !addingMp && setAddMpOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpsertMealPackStock}>
              <div className="wh-modal-body">
                {addMpError && (
                  <div className="wh-alert error" style={{ marginBottom: 0 }}>
                    <span>{addMpError}</span>
                  </div>
                )}

                <div className="wh-form-group">
                  <label className="wh-label">
                    <span>1. Choose a Meal Pack</span>
                    <span className="wh-help">
                      {allMealPacksLoading
                        ? "Loading meal packs..."
                        : `${allMealPacks.length} packs available`}
                    </span>
                  </label>
                  <input
                    type="text"
                    className="wh-input"
                    placeholder="Search meal pack by name..."
                    value={mpCatalogSearch}
                    onChange={(e) => setMpCatalogSearch(e.target.value)}
                  />

                  {filteredMpPicker.length > 0 && (
                    <div className="wh-picker-list" style={{ marginTop: 4 }}>
                      {filteredMpPicker.slice(0, 60).map((pack) => {
                        const isSel =
                          String(selectedMealPackId) === String(pack.id);
                        const packImg = getMealPackImageUrl(pack);
                        return (
                          <button
                            key={pack.id}
                            type="button"
                            className={`wh-picker-item${isSel ? " selected" : ""}`}
                            onClick={() => {
                              setSelectedMealPackId(String(pack.id));
                              const existing = mealPackStock.find(
                                (m) =>
                                  Number(m.meal_pack_id) === Number(pack.id)
                              );
                              if (existing) {
                                setNewMpQty(
                                  String(existing.quantity_on_hand ?? 0)
                                );
                              }
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                              }}
                            >
                              {packImg && (
                                <img
                                  src={packImg}
                                  alt={pack.name}
                                  className="wh-item-thumb-sm"
                                  onError={() => markImageBroken(packImg)}
                                />
                              )}
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "0.83rem",
                                  color: "#0f172a",
                                }}
                              >
                                {pack.name}
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                color: isSel ? "#0f172a" : "#64748b",
                              }}
                            >
                              {isSel ? "Selected ✓" : "Select"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="wh-form-grid">
                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>
                        Meal Pack ID <span className="req">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="wh-input"
                      placeholder="Selected automatically"
                      value={selectedMealPackId}
                      onChange={(e) => setSelectedMealPackId(e.target.value)}
                      required
                    />
                  </div>

                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>
                        Quantity On Hand <span className="req">*</span>
                      </span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="wh-input"
                      placeholder="e.g. 25"
                      value={newMpQty}
                      onChange={(e) => setNewMpQty(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setAddMpOpen(false)}
                  disabled={addingMp}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={addingMp}
                >
                  {addingMp ? "Saving..." : "Save Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 3: ORDER DETAILS
      =================================================================== */}
      {selectedOrder && (
        <div
          className="wh-modal-backdrop"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            className="wh-modal wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wh-modal-header">
              <div className="wh-modal-header-main">
                <div className="wh-modal-title-row">
                  <h3>
                    Order {selectedOrder.order_number || `#${selectedOrder.id}`}
                  </h3>
                  <span
                    className={`wh-order-status ${String(
                      selectedOrder.status || "PENDING"
                    ).toLowerCase()}`}
                  >
                    {formatOrderStatusLabel(selectedOrder.status)}
                  </span>
                </div>
                {selectedOrder.created_at && (
                  <div className="wh-modal-subtitle">
                    Placed on {formatOrderDate(selectedOrder.created_at)}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
              >
                <X size={16} />
              </button>
            </div>

            <div className="wh-modal-body">
              {/* Unified 3-Column Order Info Card */}
              <div className="wh-modal-info-grid">
                <div className="wh-modal-info-col">
                  <div className="wh-modal-info-label">Customer</div>
                  <div className="wh-modal-info-primary">
                    {selectedOrder.buyer_name || "Customer"}
                  </div>
                  {selectedOrder.buyer_phone && (
                    <div className="wh-modal-info-secondary">
                      {selectedOrder.buyer_phone}
                    </div>
                  )}
                </div>

                <div className="wh-modal-info-col">
                  <div className="wh-modal-info-label">Delivery Address</div>
                  <div className="wh-modal-info-primary">
                    {formatCleanAddress(selectedOrder.delivery_address) ||
                      "Self-pickup / Not specified"}
                  </div>
                  {selectedOrder.delivery_notes && (
                    <div className="wh-modal-info-note">
                      Note: {selectedOrder.delivery_notes}
                    </div>
                  )}
                </div>

                <div className="wh-modal-info-col">
                  <div className="wh-modal-info-label">Assigned Rider</div>
                  {selectedOrder.rider_name ? (
                    <>
                      <div className="wh-modal-info-primary">
                        {selectedOrder.rider_name}
                      </div>
                      {(selectedOrder.rider_phone ||
                        selectedOrder.rider_vehicle) && (
                        <div className="wh-modal-info-secondary">
                          {[
                            selectedOrder.rider_phone,
                            selectedOrder.rider_vehicle,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      )}
                    </>
                  ) : (
                    <div
                      className="wh-modal-info-secondary"
                      style={{ color: "#94a3b8" }}
                    >
                      Unassigned
                    </div>
                  )}
                </div>
              </div>

              {/* Ordered Items & Integrated Payment Summary */}
              <div className="wh-preview-section">
                <div className="wh-preview-section-header">
                  <h4 className="wh-preview-section-title">
                    Ordered Items (
                    {Array.isArray(selectedOrder.items)
                      ? selectedOrder.items.length
                      : 0}
                    )
                  </h4>
                </div>

                <div className="wh-table-card">
                  {Array.isArray(selectedOrder.items) &&
                  selectedOrder.items.length > 0 ? (
                    <div className="wh-table-scroll">
                      <table className="wh-table">
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th>Package Size</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th style={{ textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.items.map((it, idx) => {
                            const lineImg = getStockItemImageUrl(it);
                            return (
                              <tr key={it.id || idx}>
                                <td>
                                  <button
                                    type="button"
                                    className="wh-item-trigger"
                                    onClick={() => openIngredientPreview(it)}
                                    title="Click to preview ingredient"
                                  >
                                    {lineImg && (
                                      <img
                                        src={lineImg}
                                        alt={it.name}
                                        className="wh-item-thumb"
                                        onError={() => markImageBroken(lineImg)}
                                      />
                                    )}
                                    <div>
                                      <div className="wh-item-title">
                                        {it.name}
                                      </div>
                                      {it.source_meal_pack_name && (
                                        <div className="wh-item-sub">
                                          Pack: {it.source_meal_pack_name}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                </td>
                                <td style={{ color: "#475569" }}>
                                  {it.size || "Standard"}{" "}
                                  {it.unit_label ? `(${it.unit_label})` : ""}
                                </td>
                                <td style={{ fontWeight: 600 }}>
                                  ×{it.quantity}
                                </td>
                                <td>{formatCurrency(it.unit_price)}</td>
                                <td
                                  style={{
                                    fontWeight: 700,
                                    textAlign: "right",
                                  }}
                                >
                                  {formatCurrency(it.total)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div
                      style={{
                        padding: "16px 18px",
                        fontSize: "0.83rem",
                        color: "#64748b",
                      }}
                    >
                      No individual line items attached to this order.
                    </div>
                  )}

                  {/* Clean Right-Aligned Invoice Summary Footer */}
                  <div className="wh-order-invoice-footer">
                    <div className="wh-order-invoice-rows">
                      <div className="wh-order-invoice-row">
                        <span>Subtotal</span>
                        <span>{formatCurrency(selectedOrder.subtotal)}</span>
                      </div>
                      <div className="wh-order-invoice-row">
                        <span>Delivery Fee</span>
                        <span>{formatCurrency(selectedOrder.delivery_fee)}</span>
                      </div>
                      <div className="wh-order-invoice-row">
                        <span>Service Charge</span>
                        <span>
                          {formatCurrency(selectedOrder.service_charge)}
                        </span>
                      </div>
                      <div className="wh-order-invoice-row total">
                        <span>Total Paid</span>
                        <span>
                          {formatCurrency(selectedOrder.total_amount)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 4: EDIT WAREHOUSE INFO (`PATCH /admin/warehouses/{id}/`)
      =================================================================== */}
      {editModalOpen && (
        <div
          className="wh-modal-backdrop"
          onClick={() => !formSaving && setEditModalOpen(false)}
        >
          <div
            className="wh-modal wh-modal-form"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wh-modal-header">
              <div className="wh-modal-header-main">
                <h3>Edit Warehouse</h3>
                <div className="wh-modal-subtitle">
                  Update location, GPS coordinates, and dispatch contact details
                  for {warehouse?.name || "this warehouse"}.
                </div>
              </div>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => !formSaving && setEditModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouseEdit}>
              <div className="wh-modal-body">
                {formError && (
                  <div className="wh-alert error" style={{ marginBottom: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <AlertCircle size={16} />
                      <span>{formError}</span>
                    </div>
                  </div>
                )}

                {/* Row 1: Warehouse Name + Order Status */}
                <div className="wh-form-row-2col-asym">
                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>
                        Warehouse Name <span className="req">*</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      className="wh-input"
                      placeholder="e.g. Enugu Central Warehouse"
                      maxLength={200}
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>Order Status</span>
                    </label>
                    <select
                      className="wh-select-input"
                      value={formIsActive ? "active" : "paused"}
                      onChange={(e) =>
                        setFormIsActive(e.target.value === "active")
                      }
                    >
                      <option value="active">Accepting Orders</option>
                      <option value="paused">Paused (Hold Orders)</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Street Address */}
                <div className="wh-form-group">
                  <label className="wh-label">
                    <span>
                      Street Address <span className="req">*</span>
                    </span>
                    <span className="wh-label-hint">
                      Pickup address for delivery riders
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    className="wh-textarea"
                    placeholder="e.g. 9B Nza Street, Independence Layout, Enugu"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    required
                  />
                </div>

                {/* Row 3: Clean Grouped GPS Coordinates Card */}
                <div className="wh-coords-card">
                  <div className="wh-coords-header">
                    <div className="wh-coords-title-group">
                      <span className="wh-coords-title">GPS Coordinates</span>
                      <span className="wh-coords-sub">
                        Used to route nearby customer orders
                      </span>
                    </div>

                    <div className="wh-coords-actions">
                      <select
                        className="wh-preset-select"
                        value=""
                        onChange={(e) => {
                          const chosen = QUICK_COORD_PRESETS.find(
                            (p) => p.label === e.target.value
                          );
                          if (chosen) {
                            setFormLatitude(String(chosen.lat));
                            setFormLongitude(String(chosen.lng));
                          }
                        }}
                      >
                        <option value="">Quick-fill city...</option>
                        {QUICK_COORD_PRESETS.map((preset) => (
                          <option key={preset.label} value={preset.label}>
                            {preset.label} ({preset.lat}, {preset.lng})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="wh-btn wh-btn-xs wh-btn-secondary"
                        onClick={handleUseBrowserGps}
                        disabled={locatingGps}
                      >
                        <Navigation size={11} />
                        {locatingGps ? "Locating..." : "Use Current GPS"}
                      </button>
                    </div>
                  </div>

                  <div className="wh-form-grid">
                    <div className="wh-form-group">
                      <label className="wh-label">
                        <span>
                          Latitude <span className="req">*</span>
                        </span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="wh-input"
                        placeholder="e.g. 6.4531"
                        value={formLatitude}
                        onChange={(e) => setFormLatitude(e.target.value)}
                        required
                      />
                    </div>

                    <div className="wh-form-group">
                      <label className="wh-label">
                        <span>
                          Longitude <span className="req">*</span>
                        </span>
                      </label>
                      <input
                        type="number"
                        step="any"
                        className="wh-input"
                        placeholder="e.g. 7.5106"
                        value={formLongitude}
                        onChange={(e) => setFormLongitude(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Row 4: Dispatch Contact Info */}
                <div className="wh-form-grid">
                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>Phone Number</span>
                      <span className="wh-label-hint">Optional</span>
                    </label>
                    <input
                      type="text"
                      className="wh-input"
                      placeholder="e.g. 08065613895"
                      maxLength={20}
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                    />
                  </div>

                  <div className="wh-form-group">
                    <label className="wh-label">
                      <span>Email Address</span>
                      <span className="wh-label-hint">Optional</span>
                    </label>
                    <input
                      type="email"
                      className="wh-input"
                      placeholder="e.g. warehouse@cookeaze.app"
                      maxLength={254}
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="wh-modal-footer">
                <button
                  type="button"
                  className="wh-btn wh-btn-secondary"
                  onClick={() => setEditModalOpen(false)}
                  disabled={formSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={formSaving}
                >
                  {formSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 5: DELETE WAREHOUSE CONFIRMATION
      =================================================================== */}
      {deleteModalOpen && warehouse && (
        <div
          className="wh-modal-backdrop"
          onClick={() => !deleteSubmitting && setDeleteModalOpen(false)}
        >
          <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Delete "{warehouse.name}"?</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => !deleteSubmitting && setDeleteModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="wh-modal-body">
              <p
                style={{
                  margin: 0,
                  fontSize: "0.85rem",
                  color: "#334155",
                  lineHeight: 1.55,
                }}
              >
                Deleting this warehouse permanently removes its location and all stock counts assigned to it. If you only want to stop new orders temporarily, close this window and click{" "}
                <strong>Pause Orders</strong> instead.
              </p>
            </div>

            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="wh-btn wh-btn-danger"
                onClick={handleHardDelete}
                disabled={deleteSubmitting}
              >
                <Trash2 size={14} />
                {deleteSubmitting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 6: INGREDIENT & MEAL PACK PREVIEW (`<dialog closedby="any">`)
      =================================================================== */}
      {previewTarget && (
        <dialog
          ref={previewDialogRef}
          {...{ closedby: "any" }}
          aria-labelledby="whPreviewDialogTitle"
          className="wh-modal wide wh-native-dialog"
          onClose={closePreviewModal}
        >
          {(() => {
            const data = previewDetail || previewTarget.initialData || {};

            if (previewTarget.type === "ingredient") {
              const cid = Number(previewTarget.id);
              const stockRow =
                stockItems.find((s) => Number(s.catalog_item_id) === cid) ||
                null;
              const inStock = Number(
                stockRow?.quantity_in_stock ?? data.quantity_in_stock ?? 0
              );
              const reserved = Number(
                stockRow?.quantity_reserved ?? data.quantity_reserved ?? 0
              );
              const available =
                stockRow?.available_quantity !== undefined
                  ? Number(stockRow.available_quantity)
                  : Math.max(0, inStock - reserved);
              const editVal =
                stockEdits[cid] !== undefined ? stockEdits[cid] : inStock;
              const isDirty = Number(editVal) !== inStock;

              const heroImg = getStockItemImageUrl(data);
              const categoryName =
                data.category_name || data.category || null;
              const baseUnit = data.base_unit || null;

              let variants = [];
              if (Array.isArray(data.variants)) {
                variants = data.variants;
              } else if (typeof data.variants === "string") {
                try {
                  const parsed = JSON.parse(data.variants);
                  if (Array.isArray(parsed)) variants = parsed;
                } catch {
                  // ignore
                }
              }

              const metaParts = [];
              if (categoryName) metaParts.push(`Category: ${categoryName}`);
              if (baseUnit) metaParts.push(`Base unit: ${baseUnit}`);

              return (
                <>
                  <div className="wh-modal-header">
                    <div className="wh-modal-title-row">
                      {previewTarget.parentMealPack && (
                        <button
                          type="button"
                          className="wh-btn wh-btn-xs wh-btn-secondary"
                          onClick={() =>
                            openMealPackPreview(previewTarget.parentMealPack)
                          }
                        >
                          <ArrowLeft size={12} />
                          Back
                        </button>
                      )}
                      <h3 id="whPreviewDialogTitle">Ingredient Details</h3>
                      <span
                        className={`wh-avail-pill ${
                          available > 0 ? "in" : "out"
                        }`}
                      >
                        {available > 0 ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="wh-modal-close"
                      onClick={closePreviewModal}
                      aria-label="Close preview"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="wh-modal-body">
                    {previewError && (
                      <div className="wh-alert error" style={{ marginBottom: 0 }}>
                        <span>{previewError}</span>
                      </div>
                    )}

                    {/* Clean Product Summary Header */}
                    <div className="wh-preview-hero">
                      {heroImg && (
                        <div className="wh-preview-hero-img-wrap">
                          <img
                            src={heroImg}
                            alt={data.name}
                            className="wh-preview-hero-img"
                            onClick={() => setLightboxUrl(heroImg)}
                            onError={() => markImageBroken(heroImg)}
                            title="Click to enlarge image"
                          />
                        </div>
                      )}

                      <div className="wh-preview-hero-body">
                        <h2 className="wh-preview-title">
                          {data.name || `Ingredient #${cid}`}
                        </h2>

                        {metaParts.length > 0 && (
                          <div className="wh-preview-meta-line">
                            {metaParts.join(" · ")}
                          </div>
                        )}

                        {data.description ? (
                          <p className="wh-preview-desc">{data.description}</p>
                        ) : (
                          <p
                            className="wh-preview-desc"
                            style={{ color: "#94a3b8" }}
                          >
                            Catalog ingredient available for customer orders and meal packs.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Single-Row Warehouse Stock Bar & Inline Editor */}
                    <div className="wh-preview-stock-panel">
                      <div className="wh-preview-stock-metrics">
                        <div className="wh-preview-metric">
                          <span className="wh-preview-metric-label">
                            Total Stock
                          </span>
                          <span className="wh-preview-metric-val">
                            {inStock}
                          </span>
                        </div>
                        <div className="wh-preview-metric">
                          <span className="wh-preview-metric-label">
                            Reserved
                          </span>
                          <span
                            className="wh-preview-metric-val"
                            style={{
                              color: reserved > 0 ? "#b45309" : "#0f172a",
                            }}
                          >
                            {reserved}
                          </span>
                        </div>
                        <div className="wh-preview-metric">
                          <span className="wh-preview-metric-label">
                            Available
                          </span>
                          <span
                            className="wh-preview-metric-val"
                            style={{
                              color: available > 0 ? "#15803d" : "#b91c1c",
                            }}
                          >
                            {available}
                          </span>
                        </div>
                      </div>

                      <div className="wh-stock-editor">
                        <button
                          type="button"
                          className="wh-step-btn"
                          onClick={() =>
                            setStockEdits((prev) => ({
                              ...prev,
                              [cid]: Math.max(0, Number(editVal || 0) - 1),
                            }))
                          }
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          className="wh-stock-input"
                          value={editVal}
                          onChange={(e) =>
                            setStockEdits((prev) => ({
                              ...prev,
                              [cid]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="wh-step-btn"
                          onClick={() =>
                            setStockEdits((prev) => ({
                              ...prev,
                              [cid]: Math.max(0, Number(editVal || 0) + 1),
                            }))
                          }
                        >
                          +
                        </button>
                        <button
                          type="button"
                          className={`wh-btn wh-btn-sm ${
                            isDirty ? "wh-btn-brand" : "wh-btn-primary"
                          }`}
                          onClick={() => handleSaveRowStock(cid)}
                          disabled={savingStockId === cid}
                        >
                          {savingStockId === cid ? "Saving..." : "Update Stock"}
                        </button>
                      </div>
                    </div>

                    {/* Package Sizes & Pricing Table */}
                    <div className="wh-preview-section">
                      <div className="wh-preview-section-header">
                        <h4 className="wh-preview-section-title">
                          Package Sizes &amp; Pricing ({variants.length})
                        </h4>
                        {previewLoading && (
                          <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                            Loading sizes...
                          </span>
                        )}
                      </div>

                      {variants.length > 0 ? (
                        <div className="wh-table-card">
                          <div className="wh-table-scroll">
                            <table className="wh-table">
                              <thead>
                                <tr>
                                  <th>Package Size</th>
                                  <th>Unit Measure</th>
                                  <th>Price</th>
                                  <th style={{ textAlign: "right" }}>Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {variants.map((v, idx) => {
                                  const vInStock = v.in_stock !== false;
                                  return (
                                    <tr key={v.id || idx}>
                                      <td style={{ fontWeight: 600, color: "#0f172a" }}>
                                        {v.size || "Standard"}{" "}
                                        {v.unit_label ? `(${v.unit_label})` : ""}
                                      </td>
                                      <td style={{ color: "#64748b" }}>
                                        {v.quantity_in_base_unit !== undefined
                                          ? `${v.quantity_in_base_unit} ${
                                              baseUnit || "unit"
                                            }`
                                          : v.unit_label || "Standard pack"}
                                      </td>
                                      <td style={{ fontWeight: 700, color: "#0f172a" }}>
                                        {formatCurrency(v.price)}
                                      </td>
                                      <td style={{ textAlign: "right" }}>
                                        <span
                                          className={`wh-avail-pill ${
                                            vInStock ? "in" : "out"
                                          }`}
                                        >
                                          {vInStock ? "Active" : "Unavailable"}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : previewLoading ? (
                        <div
                          className="wh-shimmer"
                          style={{ height: 58, borderRadius: 10 }}
                        />
                      ) : (
                        <div className="wh-meta-box">
                          No individual package variants configured for this ingredient.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="wh-modal-footer">
                    <button
                      type="button"
                      className="wh-btn wh-btn-secondary"
                      onClick={closePreviewModal}
                    >
                      Close
                    </button>
                  </div>
                </>
              );
            }

            /* ===============================================================
               MEAL PACK PREVIEW CONTENT
            =============================================================== */
            const mpid = Number(previewTarget.id);
            const mpRow =
              mealPackStock.find((m) => Number(m.meal_pack_id) === mpid) ||
              null;
            const onHand = Number(
              mpRow?.quantity_on_hand ?? data.quantity_on_hand ?? 0
            );
            const reserved = Number(
              mpRow?.quantity_reserved ?? data.quantity_reserved ?? 0
            );
            const available = mpRow
              ? mpRow.available_quantity !== undefined
                ? Number(mpRow.available_quantity)
                : Math.max(0, onHand - reserved)
              : Number(data.available_quantity ?? 0);

            const editVal =
              mpEdits[mpid] !== undefined ? mpEdits[mpid] : onHand;
            const isDirty = Number(editVal) !== onHand;
            const heroImg = getMealPackImageUrl(data);
            const estPrice =
              data.estimated_price ?? data.estimated_cost ?? null;

            let packIngredients = [];
            const rawIngs = data.ingredients ?? data.items ?? [];
            if (Array.isArray(rawIngs)) {
              packIngredients = rawIngs;
            } else if (typeof rawIngs === "string") {
              try {
                const parsed = JSON.parse(rawIngs);
                if (Array.isArray(parsed)) packIngredients = parsed;
              } catch {
                // ignore
              }
            }

            const ingCount =
              packIngredients.length || Number(data.ingredient_count || 0);

            const packMetaParts = [];
            if (estPrice !== null && estPrice !== undefined) {
              packMetaParts.push(`Estimated Price: ${formatCurrency(estPrice)}`);
            }
            if (ingCount > 0) {
              packMetaParts.push(
                `${ingCount} ${ingCount === 1 ? "Ingredient" : "Ingredients"}`
              );
            }
            packMetaParts.push(
              mpRow
                ? "Pre-packed stock tracked"
                : "Calculated from Ingredients Stock"
            );

            return (
              <>
                <div className="wh-modal-header">
                  <div className="wh-modal-title-row">
                    <h3 id="whPreviewDialogTitle">Meal Pack Details</h3>
                    <span
                      className={`wh-avail-pill ${
                        available > 0 || !mpRow ? "in" : "out"
                      }`}
                    >
                      {mpRow
                        ? available > 0
                          ? "In Stock"
                          : "Out of Stock"
                        : "Available"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="wh-modal-close"
                    onClick={closePreviewModal}
                    aria-label="Close preview"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="wh-modal-body">
                  {previewError && (
                    <div className="wh-alert error" style={{ marginBottom: 0 }}>
                      <span>{previewError}</span>
                    </div>
                  )}

                  {/* Clean Meal Pack Summary Header */}
                  <div className="wh-preview-hero">
                    {heroImg && (
                      <div className="wh-preview-hero-img-wrap">
                        <img
                          src={heroImg}
                          alt={data.name}
                          className="wh-preview-hero-img"
                          onClick={() => setLightboxUrl(heroImg)}
                          onError={() => markImageBroken(heroImg)}
                          title="Click to enlarge image"
                        />
                      </div>
                    )}

                    <div className="wh-preview-hero-body">
                      <h2 className="wh-preview-title">
                        {data.name || `Meal Pack #${mpid}`}
                      </h2>

                      {packMetaParts.length > 0 && (
                        <div className="wh-preview-meta-line">
                          {packMetaParts.join(" · ")}
                        </div>
                      )}

                      {data.description ? (
                        <p className="wh-preview-desc">{data.description}</p>
                      ) : (
                        <p
                          className="wh-preview-desc"
                          style={{ color: "#94a3b8" }}
                        >
                          Curated meal pack bundle with pre-portioned recipe ingredients.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Single-Row Pre-packed Warehouse Stock Bar */}
                  <div className="wh-preview-stock-panel">
                    <div className="wh-preview-stock-metrics">
                      <div className="wh-preview-metric">
                        <span className="wh-preview-metric-label">
                          Pre-packed On Hand
                        </span>
                        <span className="wh-preview-metric-val">{onHand}</span>
                      </div>
                      <div className="wh-preview-metric">
                        <span className="wh-preview-metric-label">
                          Reserved
                        </span>
                        <span
                          className="wh-preview-metric-val"
                          style={{
                            color: reserved > 0 ? "#b45309" : "#0f172a",
                          }}
                        >
                          {reserved}
                        </span>
                      </div>
                      <div className="wh-preview-metric">
                        <span className="wh-preview-metric-label">
                          Available
                        </span>
                        <span
                          className="wh-preview-metric-val"
                          style={{
                            color:
                              available > 0 || !mpRow ? "#15803d" : "#b91c1c",
                          }}
                        >
                          {mpRow
                            ? available
                            : available > 0
                            ? available
                            : "Auto"}
                        </span>
                      </div>
                    </div>

                    <div className="wh-stock-editor">
                      <button
                        type="button"
                        className="wh-step-btn"
                        onClick={() =>
                          setMpEdits((prev) => ({
                            ...prev,
                            [mpid]: Math.max(0, Number(editVal || 0) - 1),
                          }))
                        }
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        className="wh-stock-input"
                        value={editVal}
                        onChange={(e) =>
                          setMpEdits((prev) => ({
                            ...prev,
                            [mpid]: e.target.value,
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="wh-step-btn"
                        onClick={() =>
                          setMpEdits((prev) => ({
                            ...prev,
                            [mpid]: Math.max(0, Number(editVal || 0) + 1),
                          }))
                        }
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className={`wh-btn wh-btn-sm ${
                          isDirty ? "wh-btn-brand" : "wh-btn-primary"
                        }`}
                        onClick={() => handleSaveRowMealPackStock(mpid)}
                        disabled={savingMpId === mpid}
                      >
                        {savingMpId === mpid ? "Saving..." : "Update Stock"}
                      </button>
                    </div>
                  </div>

                  {/* Included Ingredients Breakdown */}
                  <div className="wh-preview-section">
                    <div className="wh-preview-section-header">
                      <h4 className="wh-preview-section-title">
                        Included Ingredients ({packIngredients.length})
                      </h4>
                      {previewLoading && (
                        <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                          Loading ingredients...
                        </span>
                      )}
                    </div>

                    {packIngredients.length > 0 ? (
                      <div className="wh-table-card">
                        <div className="wh-table-scroll">
                          <table className="wh-table">
                            <thead>
                              <tr>
                                <th>Ingredient</th>
                                <th>Category</th>
                                <th>Qty in Pack</th>
                                <th>Warehouse Stock</th>
                                <th style={{ textAlign: "right" }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {packIngredients.map((ing, idx) => {
                                const ingCid = Number(
                                  ing.catalog_item_id ?? ing.id ?? 0
                                );
                                const ingNameKey = String(ing.name || "")
                                  .trim()
                                  .toLowerCase();
                                const matchedStock = stockItems.find(
                                  (s) =>
                                    (ingCid &&
                                      Number(s.catalog_item_id) === ingCid) ||
                                    (ingNameKey &&
                                      String(s.name || "")
                                        .trim()
                                        .toLowerCase() === ingNameKey)
                                );
                                const whAvail = matchedStock
                                  ? matchedStock.available_quantity !== undefined
                                    ? Number(matchedStock.available_quantity)
                                    : Math.max(
                                        0,
                                        Number(
                                          matchedStock.quantity_in_stock || 0
                                        ) -
                                          Number(
                                            matchedStock.quantity_reserved || 0
                                          )
                                      )
                                  : null;

                                const catEntry =
                                  (ingCid && catalogById.get(ingCid)) ||
                                  catalogList.find(
                                    (c) =>
                                      String(c.name || "")
                                        .trim()
                                        .toLowerCase() === ingNameKey
                                  ) ||
                                  null;
                                const catLabel =
                                  ing.category_name ||
                                  ing.category ||
                                  catEntry?.category_name ||
                                  catEntry?.category ||
                                  "Catalog Item";

                                const ingImg = getStockItemImageUrl(ing);
                                const qtyInPack =
                                  ing.suggested_quantity ?? ing.quantity ?? 1;
                                const sizeHint =
                                  ing.size ||
                                  ing.variant_size ||
                                  catEntry?.variants?.[0]?.size ||
                                  null;

                                return (
                                  <tr key={ing.id || ingCid || idx}>
                                    <td>
                                      <button
                                        type="button"
                                        className="wh-item-trigger"
                                        onClick={() =>
                                          openIngredientPreview(ing, data)
                                        }
                                        title="Click to preview this ingredient"
                                      >
                                        {ingImg && (
                                          <img
                                            src={ingImg}
                                            alt={ing.name}
                                            className="wh-item-thumb-sm"
                                            onError={() =>
                                              markImageBroken(ingImg)
                                            }
                                          />
                                        )}
                                        <div>
                                          <div className="wh-item-title">
                                            {ing.name ||
                                              `Ingredient #${ingCid || idx + 1}`}
                                          </div>
                                          {sizeHint && (
                                            <div className="wh-item-sub">
                                              {sizeHint}
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    </td>
                                    <td style={{ color: "#475569" }}>
                                      {catLabel}
                                    </td>
                                    <td style={{ fontWeight: 700, color: "#0f172a" }}>
                                      ×{qtyInPack}
                                    </td>
                                    <td>
                                      {whAvail !== null ? (
                                        <span
                                          className={`wh-avail-pill ${
                                            whAvail > 0 ? "in" : "out"
                                          }`}
                                        >
                                          {whAvail > 0
                                            ? `${whAvail} available`
                                            : "Out of stock"}
                                        </span>
                                      ) : (
                                        <span
                                          className="wh-avail-pill out"
                                        >
                                          Not stocked
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: "right" }}>
                                      <button
                                        type="button"
                                        className="wh-preview-pill"
                                        onClick={() =>
                                          openIngredientPreview(ing, data)
                                        }
                                      >
                                        View
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : previewLoading ? (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div
                            key={idx}
                            className="wh-shimmer"
                            style={{ height: 44, borderRadius: 8 }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="wh-meta-box">
                        No individual ingredient items returned for this meal pack.
                      </div>
                    )}
                  </div>
                </div>

                <div className="wh-modal-footer">
                  <button
                    type="button"
                    className="wh-btn wh-btn-secondary"
                    onClick={closePreviewModal}
                  >
                    Close
                  </button>
                </div>
              </>
            );
          })()}
        </dialog>
      )}

      {/* Fullscreen Image Lightbox */}
      {lightboxUrl && (
        <div
          className="wh-lightbox-backdrop"
          onClick={() => setLightboxUrl(null)}
        >
          <img
            src={lightboxUrl}
            alt="Full preview"
            className="wh-lightbox-img"
          />
        </div>
      )}
    </div>
  );
}
