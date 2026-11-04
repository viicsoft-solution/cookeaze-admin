// src/pages/CouponsPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Ticket,
  X,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  FlaskConical,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./CouponsPage.css";

const POPULAR_CITIES = [
  "Enugu",
  "Lagos",
  "Abuja",
  "Port Harcourt",
  "Awka",
  "Owerri",
  "Asaba",
  "Ibadan",
];

function extractList(payload, keys = []) {
  const root = payload?.data !== undefined ? payload.data : payload;
  if (!root) return [];
  if (Array.isArray(root)) return root;

  for (const k of keys) {
    if (Array.isArray(root[k])) return root[k];
    if (root.data && Array.isArray(root.data[k])) return root.data[k];
  }

  const fallbacks = ["coupons", "users", "results", "data", "items"];
  for (const k of fallbacks) {
    if (Array.isArray(root[k])) return root[k];
    if (root.data && Array.isArray(root.data[k])) return root.data[k];
  }
  return [];
}

function extractObject(payload) {
  const root = payload?.data !== undefined ? payload.data : payload;
  if (!root || typeof root !== "object") return null;
  if (root.coupon && typeof root.coupon === "object") return root.coupon;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data;
  }
  return root;
}

function formatNaira(val) {
  const num = Number(val);
  if (val === null || val === undefined || val === "" || Number.isNaN(num)) {
    return "₦0.00";
  }
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return "No expiry";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toDateInputValue(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function extractApiError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
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
  return fallback;
}

function normalizeCoupon(raw) {
  if (!raw || typeof raw !== "object") return null;

  const targetLocations = Array.isArray(raw.target_locations)
    ? raw.target_locations
    : typeof raw.target_locations === "string" && raw.target_locations.trim()
    ? raw.target_locations
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const targetUsers = Array.isArray(raw.target_users)
    ? raw.target_users
        .map((u) => (typeof u === "object" && u !== null ? u.id : Number(u)))
        .filter((id) => !Number.isNaN(id))
    : [];

  const isExpired =
    raw.expires_at && new Date(raw.expires_at).getTime() < Date.now();

  return {
    id: raw.id,
    code: String(raw.code || "").trim().toUpperCase(),
    title: String(raw.title || raw.code || `Coupon #${raw.id}`).trim(),
    description: raw.description || "",
    image_url: raw.image_url || "",
    discount_type: raw.discount_type || "percentage",
    discount_value: raw.discount_value ?? "0.00",
    max_discount_amount: raw.max_discount_amount ?? null,
    min_order_amount: raw.min_order_amount ?? "0.00",
    coupon_type: raw.coupon_type || "general",
    target_users: targetUsers,
    target_locations: targetLocations,
    max_total_uses:
      raw.max_total_uses !== undefined ? raw.max_total_uses : null,
    max_uses_per_user:
      raw.max_uses_per_user !== undefined ? Number(raw.max_uses_per_user) : 1,
    current_total_uses:
      raw.current_total_uses !== undefined ? Number(raw.current_total_uses) : 0,
    is_active: raw.is_active !== false,
    is_expired: Boolean(isExpired),
    starts_at: raw.starts_at || null,
    expires_at: raw.expires_at || null,
  };
}

function formatDiscountSummary(coupon) {
  if (!coupon) return "—";
  if (coupon.discount_type === "free_delivery") {
    return "Free Delivery";
  }
  if (coupon.discount_type === "percentage") {
    const pct = Number(coupon.discount_value) || 0;
    return `${pct}% OFF`;
  }
  return `${formatNaira(coupon.discount_value)} OFF`;
}

function formatScopeSummary(coupon) {
  if (!coupon) return "All Users";
  if (coupon.coupon_type === "location_based") {
    return coupon.target_locations.length > 0
      ? coupon.target_locations.join(", ")
      : "City Based";
  }
  if (coupon.coupon_type === "user_based") {
    return `${coupon.target_users.length} ${
      coupon.target_users.length === 1 ? "User" : "Users"
    }`;
  }
  return "All Users";
}

export default function CouponsPage() {
  const [couponsRaw, setCouponsRaw] = useState([]);
  const [usersList, setUsersList] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive | expired
  const [typeFilter, setTypeFilter] = useState("all"); // all | percentage | fixed | free_delivery
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Coupon Modal (`POST /api/coupons/`, `PATCH /api/coupons/{id}/`)
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  const [formCode, setFormCode] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDiscountType, setFormDiscountType] = useState("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState("10");
  const [formMaxDiscountAmount, setFormMaxDiscountAmount] = useState("");
  const [formMinOrderAmount, setFormMinOrderAmount] = useState("0");
  const [formCouponType, setFormCouponType] = useState("general");
  const [formTargetUsers, setFormTargetUsers] = useState([]);
  const [formSelectedCities, setFormSelectedCities] = useState([]);
  const [formCustomCityInput, setFormCustomCityInput] = useState("");
  const [formMaxTotalUses, setFormMaxTotalUses] = useState("");
  const [formMaxUsesPerUser, setFormMaxUsesPerUser] = useState("1");
  const [formStartsAt, setFormStartsAt] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [userSearchText, setUserSearchText] = useState("");
  const [savingCoupon, setSavingCoupon] = useState(false);

  // Inspect Coupon Detail Modal (`GET /api/coupons/{id}/`)
  const [inspectCoupon, setInspectCoupon] = useState(null);

  // Validate / Simulate Coupon Modal (`POST /api/coupons/validate/`)
  const [validateModalOpen, setValidateModalOpen] = useState(false);
  const [simCode, setSimCode] = useState("");
  const [simSubtotal, setSimSubtotal] = useState("5000");
  const [simDeliveryFee, setSimDeliveryFee] = useState("1000");
  const [simCity, setSimCity] = useState("Enugu");
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState(null);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code);
    setCopiedCode(code);
    setTimeout(() => {
      setCopiedCode((prev) => (prev === code ? null : prev));
    }, 1800);
  };

  const loadUsersForPicker = useCallback(async (api) => {
    try {
      const res = await api.get("/users/");
      const rawUsers = extractList(res, ["users", "results", "data"]);
      const formatted = rawUsers
        .filter((u) => u && u.id !== undefined)
        .map((u) => {
          const fullName = [u.first_name, u.last_name]
            .filter(Boolean)
            .join(" ")
            .trim();
          return {
            id: Number(u.id),
            name: fullName || u.username || u.email || `User #${u.id}`,
            email: u.email || "",
          };
        });
      setUsersList(formatted);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchCoupons = useCallback(
    async (isSilent = false) => {
      if (isSilent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const api = getAxiosInstance();
      try {
        const [couponsRes] = await Promise.all([
          api.get("/coupons/"),
          loadUsersForPicker(api),
        ]);

        const baseList = extractList(couponsRes, [
          "coupons",
          "results",
          "data",
        ]);

        const hydrated = await Promise.all(
          baseList.map(async (c) => {
            if (!c?.id) return c;
            try {
              const detailRes = await api.get(`/coupons/${c.id}/`);
              const detailObj = extractObject(detailRes);
              return detailObj ? { ...c, ...detailObj } : c;
            } catch {
              return c;
            }
          })
        );

        setCouponsRaw(hydrated);
      } catch (err) {
        showToast(
          "error",
          extractApiError(err, "Unable to load coupons from the server.")
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadUsersForPicker, showToast]
  );

  useEffect(() => {
    fetchCoupons(false);
  }, [fetchCoupons]);

  const coupons = useMemo(
    () => couponsRaw.map(normalizeCoupon).filter(Boolean),
    [couponsRaw]
  );

  const summaryStats = useMemo(() => {
    let activeCount = 0;
    let totalRedemptions = 0;
    let targetedCount = 0;

    coupons.forEach((c) => {
      if (c.is_active && !c.is_expired) activeCount += 1;
      totalRedemptions += c.current_total_uses || 0;
      if (c.coupon_type !== "general") targetedCount += 1;
    });

    return {
      totalCoupons: coupons.length,
      activeCount,
      totalRedemptions,
      targetedCount,
    };
  }, [coupons]);

  const filteredCoupons = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return coupons.filter((c) => {
      if (statusFilter === "active" && (!c.is_active || c.is_expired)) {
        return false;
      }
      if (statusFilter === "inactive" && c.is_active) {
        return false;
      }
      if (statusFilter === "expired" && !c.is_expired) {
        return false;
      }

      if (typeFilter !== "all" && c.discount_type !== typeFilter) {
        return false;
      }

      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.target_locations.join(" ").toLowerCase().includes(q)
      );
    });
  }, [coupons, statusFilter, typeFilter, searchQuery]);

  const handleToggleCouponActive = async (coupon) => {
    const api = getAxiosInstance();
    try {
      await api.patch(`/coupons/${coupon.id}/`, {
        code: coupon.code,
        title: coupon.title,
        discount_type: coupon.discount_type,
        is_active: !coupon.is_active,
      });
      showToast(
        "success",
        `Coupon ${coupon.code} ${!coupon.is_active ? "activated" : "deactivated"}.`
      );
      await fetchCoupons(true);
    } catch (err) {
      showToast("error", extractApiError(err, "Failed to update coupon status."));
    }
  };

  // Open Create Coupon Modal
  const handleOpenCreateModal = () => {
    setEditingCoupon(null);
    setFormCode("");
    setFormTitle("");
    setFormDescription("");
    setFormDiscountType("percentage");
    setFormDiscountValue("10");
    setFormMaxDiscountAmount("");
    setFormMinOrderAmount("0");
    setFormCouponType("general");
    setFormTargetUsers([]);
    setFormSelectedCities([]);
    setFormCustomCityInput("");
    setFormMaxTotalUses("");
    setFormMaxUsesPerUser("1");
    setFormStartsAt("");
    setFormExpiresAt("");
    setFormIsActive(true);
    setUserSearchText("");
    setFormModalOpen(true);
  };

  // Open Edit Coupon Modal
  const handleOpenEditModal = async (coupon) => {
    setEditingCoupon(coupon);
    setFormCode(coupon.code || "");
    setFormTitle(coupon.title || "");
    setFormDescription(coupon.description || "");
    setFormDiscountType(coupon.discount_type || "percentage");
    setFormDiscountValue(String(Number(coupon.discount_value ?? 0)));
    setFormMaxDiscountAmount(
      coupon.max_discount_amount !== null &&
        coupon.max_discount_amount !== undefined
        ? String(Number(coupon.max_discount_amount))
        : ""
    );
    setFormMinOrderAmount(String(Number(coupon.min_order_amount ?? 0)));
    setFormCouponType(coupon.coupon_type || "general");
    setFormTargetUsers(coupon.target_users || []);
    setFormSelectedCities(coupon.target_locations || []);
    setFormCustomCityInput("");
    setFormMaxTotalUses(
      coupon.max_total_uses !== null && coupon.max_total_uses !== undefined
        ? String(coupon.max_total_uses)
        : ""
    );
    setFormMaxUsesPerUser(String(coupon.max_uses_per_user ?? 1));
    setFormStartsAt(toDateInputValue(coupon.starts_at));
    setFormExpiresAt(toDateInputValue(coupon.expires_at));
    setFormIsActive(coupon.is_active !== false);
    setUserSearchText("");
    setFormModalOpen(true);

    try {
      const api = getAxiosInstance();
      const res = await api.get(`/coupons/${coupon.id}/`);
      const detail = extractObject(res);
      if (detail) {
        const norm = normalizeCoupon(detail);
        if (norm) {
          setFormCouponType(norm.coupon_type || "general");
          setFormTargetUsers(norm.target_users || []);
          setFormSelectedCities(norm.target_locations || []);
          setFormMaxTotalUses(
            norm.max_total_uses !== null && norm.max_total_uses !== undefined
              ? String(norm.max_total_uses)
              : ""
          );
          setFormMaxUsesPerUser(String(norm.max_uses_per_user ?? 1));
          setFormStartsAt(toDateInputValue(norm.starts_at));
          setFormExpiresAt(toDateInputValue(norm.expires_at));
        }
      }
    } catch {
      // keep existing fields
    }
  };

  const toggleCitySelection = (city) => {
    setFormSelectedCities((prev) => {
      const exists = prev.some((c) => c.toLowerCase() === city.toLowerCase());
      if (exists) {
        return prev.filter((c) => c.toLowerCase() !== city.toLowerCase());
      }
      return [...prev, city];
    });
  };

  const handleAddCustomCity = () => {
    const trimmed = formCustomCityInput.trim();
    if (!trimmed) return;
    if (
      !formSelectedCities.some(
        (c) => c.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setFormSelectedCities((prev) => [...prev, trimmed]);
    }
    setFormCustomCityInput("");
  };

  const toggleTargetUserInForm = (userId) => {
    const numId = Number(userId);
    setFormTargetUsers((prev) =>
      prev.includes(numId)
        ? prev.filter((id) => id !== numId)
        : [...prev, numId]
    );
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    const cleanTitle = formTitle.trim();

    if (!cleanCode || !cleanTitle) {
      showToast("error", "Coupon code and title are required.");
      return;
    }

    const finalCities = [...formSelectedCities];
    if (formCustomCityInput.trim()) {
      finalCities.push(formCustomCityInput.trim());
    }

    if (formCouponType === "user_based" && formTargetUsers.length === 0) {
      showToast("error", "Please select at least one user.");
      return;
    }

    if (formCouponType === "location_based" && finalCities.length === 0) {
      showToast("error", "Please select at least one city.");
      return;
    }

    const payload = {
      code: cleanCode,
      title: cleanTitle,
      description: formDescription.trim(),
      discount_type: formDiscountType,
      discount_value:
        formDiscountType === "free_delivery"
          ? "0.00"
          : String(formDiscountValue || "0").trim(),
      max_discount_amount:
        formDiscountType === "percentage" && formMaxDiscountAmount.trim() !== ""
          ? String(formMaxDiscountAmount).trim()
          : null,
      min_order_amount: String(formMinOrderAmount || "0").trim(),
      coupon_type: formCouponType,
      target_users: formCouponType === "user_based" ? formTargetUsers : [],
      target_locations:
        formCouponType === "location_based" ? finalCities : [],
      max_total_uses:
        formMaxTotalUses.trim() !== "" ? Number(formMaxTotalUses) : null,
      max_uses_per_user: Math.max(1, Number(formMaxUsesPerUser) || 1),
      is_active: Boolean(formIsActive),
      starts_at: formStartsAt
        ? new Date(`${formStartsAt}T00:00:00`).toISOString()
        : null,
      expires_at: formExpiresAt
        ? new Date(`${formExpiresAt}T23:59:59`).toISOString()
        : null,
    };

    setSavingCoupon(true);
    const api = getAxiosInstance();
    try {
      if (editingCoupon) {
        const res = await api.patch(`/coupons/${editingCoupon.id}/`, payload);
        const updatedObj = extractObject(res) || {
          ...editingCoupon,
          ...payload,
        };
        setCouponsRaw((prev) =>
          prev.map((item) =>
            Number(item.id) === Number(editingCoupon.id)
              ? { ...item, ...updatedObj }
              : item
          )
        );
        showToast("success", `Coupon ${cleanCode} updated.`);
      } else {
        const res = await api.post("/coupons/", payload);
        const createdObj = extractObject(res);
        if (createdObj && createdObj.id) {
          setCouponsRaw((prev) => [createdObj, ...prev]);
        }
        showToast("success", `Coupon ${cleanCode} created.`);
      }
      setFormModalOpen(false);
      await fetchCoupons(true);
    } catch (err) {
      showToast("error", extractApiError(err, "Failed to save coupon."));
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleInspectCoupon = async (coupon) => {
    setInspectCoupon(coupon);
    try {
      const api = getAxiosInstance();
      const res = await api.get(`/coupons/${coupon.id}/`);
      const detail = extractObject(res);
      if (detail) {
        const norm = normalizeCoupon(detail);
        if (norm) setInspectCoupon(norm);
      }
    } catch {
      // keep existing
    }
  };

  const handleOpenValidator = (prefillCode = "") => {
    setSimCode(prefillCode || coupons[0]?.code || "");
    setValidationResult(null);
    setValidateModalOpen(true);
  };

  const handleRunValidation = async (e) => {
    e.preventDefault();
    if (!simCode.trim()) {
      showToast("error", "Enter a coupon code to test.");
      return;
    }

    setValidating(true);
    setValidationResult(null);
    const api = getAxiosInstance();
    try {
      const res = await api.post("/coupons/validate/", {
        code: simCode.trim().toUpperCase(),
        subtotal: String(simSubtotal || "0"),
        delivery_fee: String(simDeliveryFee || "0"),
        city: simCity.trim(),
      });
      const data = res?.data?.data || res?.data || {};
      setValidationResult({
        valid: true,
        message:
          res?.data?.message || "Coupon is valid and eligible for checkout.",
        data,
      });
    } catch (err) {
      setValidationResult({
        valid: false,
        message: extractApiError(
          err,
          "Coupon is invalid, expired, or ineligible for these parameters."
        ),
        data: err?.response?.data || null,
      });
    } finally {
      setValidating(false);
    }
  };

  const filteredPickerUsers = useMemo(() => {
    const q = userSearchText.trim().toLowerCase();
    const list = !q
      ? usersList
      : usersList.filter(
          (u) =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            String(u.id).includes(q)
        );
    return list.slice(0, 60);
  }, [usersList, userSearchText]);

  const allDisplayCities = useMemo(() => {
    const set = new Set(POPULAR_CITIES);
    formSelectedCities.forEach((c) => set.add(c));
    return Array.from(set);
  }, [formSelectedCities]);

  return (
    <div className="cpn-page">
      {/* ── Page Header ── */}
      <header className="cpn-header">
        <div className="cpn-header-copy">
          <h1 className="cpn-title">Promotional Coupons</h1>
          <p className="cpn-subtitle">
            Manage discount codes, minimum order rules, and city or customer eligibility.
          </p>
        </div>

        <div className="cpn-header-actions">
          <button
            type="button"
            className="cpn-btn"
            onClick={() => handleOpenValidator("")}
          >
            <FlaskConical size={14} />
            Test Code
          </button>

          <button
            type="button"
            className="cpn-btn"
            onClick={() => fetchCoupons(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={14}
              className={loading || refreshing ? "cpn-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="cpn-btn cpn-btn-primary"
            onClick={handleOpenCreateModal}
          >
            <Plus size={15} />
            New Coupon
          </button>
        </div>
      </header>

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`cpn-toast ${
            toast.type === "error" ? "cpn-toast-error" : "cpn-toast-success"
          }`}
          role="status"
        >
          <div className="cpn-toast-left">
            {toast.type === "error" ? (
              <AlertCircle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="cpn-toast-close"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Clean 4-Column Summary Ribbon (Zero Corner Badge Clutter) ── */}
      <section className="cpn-summary-ribbon" aria-label="Coupon summary">
        <div className="cpn-summary-cell">
          <span className="cpn-summary-label">Total Coupons</span>
          <div className="cpn-summary-val">
            {loading ? "—" : summaryStats.totalCoupons.toLocaleString()}
          </div>
          <span className="cpn-summary-meta">All configured codes</span>
        </div>

        <div className="cpn-summary-cell">
          <span className="cpn-summary-label">Active Coupons</span>
          <div className="cpn-summary-val">
            {loading ? "—" : summaryStats.activeCount.toLocaleString()}
          </div>
          <span className="cpn-summary-meta">Currently redeemable</span>
        </div>

        <div className="cpn-summary-cell">
          <span className="cpn-summary-label">Total Redemptions</span>
          <div className="cpn-summary-val">
            {loading ? "—" : summaryStats.totalRedemptions.toLocaleString()}
          </div>
          <span className="cpn-summary-meta">Completed checkouts</span>
        </div>

        <div className="cpn-summary-cell">
          <span className="cpn-summary-label">Targeted Coupons</span>
          <div className="cpn-summary-val">
            {loading ? "—" : summaryStats.targetedCount.toLocaleString()}
          </div>
          <span className="cpn-summary-meta">City or user specific</span>
        </div>
      </section>

      {/* ── Main Coupons Workbench ── */}
      <section className="cpn-workbench">
        <div className="cpn-toolbar">
          <div className="cpn-filter-tabs" role="tablist">
            <button
              type="button"
              className={`cpn-filter-tab ${
                statusFilter === "all" ? "active" : ""
              }`}
              onClick={() => setStatusFilter("all")}
            >
              All ({coupons.length})
            </button>
            <button
              type="button"
              className={`cpn-filter-tab ${
                statusFilter === "active" ? "active" : ""
              }`}
              onClick={() => setStatusFilter("active")}
            >
              Active ({summaryStats.activeCount})
            </button>
            <button
              type="button"
              className={`cpn-filter-tab ${
                statusFilter === "inactive" ? "active" : ""
              }`}
              onClick={() => setStatusFilter("inactive")}
            >
              Inactive
            </button>
            <button
              type="button"
              className={`cpn-filter-tab ${
                statusFilter === "expired" ? "active" : ""
              }`}
              onClick={() => setStatusFilter("expired")}
            >
              Expired
            </button>
          </div>

          <div className="cpn-toolbar-right">
            <select
              className="cpn-select-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              aria-label="Filter by discount type"
            >
              <option value="all">All Discount Types</option>
              <option value="percentage">Percentage (%)</option>
              <option value="fixed">Fixed Amount (₦)</option>
              <option value="free_delivery">Free Delivery</option>
            </select>

            <div className="cpn-search-wrap">
              <Search size={14} className="cpn-search-icon" />
              <input
                type="text"
                className="cpn-search-input"
                placeholder="Search code, title, or city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="cpn-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: "36px", textAlign: "center", color: "#64748b" }}>
            Loading coupons...
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="cpn-empty-state">
            <div className="cpn-empty-icon">
              <Ticket size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: "0.92rem", fontWeight: 700 }}>
              No coupons found
            </h3>
            <p
              style={{
                margin: "0 0 8px",
                fontSize: "0.8rem",
                color: "#64748b",
                maxWidth: 360,
              }}
            >
              Create promotional coupon codes for general checkout, specific users, or target cities.
            </p>
            <button
              type="button"
              className="cpn-btn cpn-btn-primary"
              onClick={handleOpenCreateModal}
            >
              <Plus size={14} />
              New Coupon
            </button>
          </div>
        ) : (
          <>
            <div className="cpn-table-wrap">
              <table className="cpn-table">
                <thead>
                  <tr>
                    <th className="cpn-col-code">Code</th>
                    <th className="cpn-col-title">Coupon</th>
                    <th className="cpn-col-discount">Discount</th>
                    <th className="cpn-col-min">Min. Order</th>
                    <th className="cpn-col-scope">Eligibility</th>
                    <th className="cpn-col-usage">Usage</th>
                    <th className="cpn-col-expires">Expires</th>
                    <th className="cpn-col-status">Status</th>
                    <th className="cpn-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoupons.map((c) => (
                    <tr key={c.id || c.code}>
                      <td className="cpn-col-code">
                        <button
                          type="button"
                          className="cpn-code-btn"
                          onClick={() => handleCopyCode(c.code)}
                          title="Copy code"
                        >
                          <span>{c.code}</span>
                          {copiedCode === c.code ? (
                            <Check size={11} color="#16a34a" />
                          ) : (
                            <Copy size={11} color="#94a3b8" />
                          )}
                        </button>
                      </td>

                      <td className="cpn-col-title">
                        <span
                          className="cpn-title-link"
                          onClick={() => handleInspectCoupon(c)}
                          title={c.title}
                        >
                          {c.title}
                        </span>
                      </td>

                      <td className="cpn-col-discount">
                        <span className="cpn-discount-text">
                          {formatDiscountSummary(c)}
                        </span>
                      </td>

                      <td className="cpn-col-min">
                        <span style={{ color: "#475569" }}>
                          {Number(c.min_order_amount) > 0
                            ? formatNaira(c.min_order_amount)
                            : "None"}
                        </span>
                      </td>

                      <td className="cpn-col-scope">
                        <span
                          style={{ color: "#475569", fontWeight: 500 }}
                          title={formatScopeSummary(c)}
                        >
                          {formatScopeSummary(c)}
                        </span>
                      </td>

                      <td className="cpn-col-usage">
                        <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                          {c.current_total_uses}
                          {c.max_total_uses ? ` / ${c.max_total_uses}` : ""}
                        </span>
                      </td>

                      <td className="cpn-col-expires">
                        <span
                          style={{
                            color: c.is_expired ? "#b91c1c" : "#475569",
                            fontSize: "0.8rem",
                          }}
                        >
                          {formatDateDisplay(c.expires_at)}
                        </span>
                      </td>

                      <td className="cpn-col-status">
                        {c.is_expired ? (
                          <span className="cpn-status-badge cpn-status-expired">
                            Expired
                          </span>
                        ) : c.is_active ? (
                          <span className="cpn-status-badge cpn-status-active">
                            Active
                          </span>
                        ) : (
                          <span className="cpn-status-badge cpn-status-inactive">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="cpn-col-actions">
                        <div className="cpn-row-actions">
                          <button
                            type="button"
                            className="cpn-btn cpn-btn-sm"
                            onClick={() => handleInspectCoupon(c)}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="cpn-btn cpn-btn-sm"
                            onClick={() => handleOpenEditModal(c)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Responsive Cards */}
            <div className="cpn-mobile-list">
              {filteredCoupons.map((c) => (
                <div key={c.id || c.code} className="cpn-mobile-card">
                  <div className="cpn-mobile-top">
                    <div>
                      <button
                        type="button"
                        className="cpn-code-btn"
                        onClick={() => handleCopyCode(c.code)}
                      >
                        {c.code}
                      </button>
                      <div style={{ fontWeight: 700, marginTop: "4px", fontSize: "0.86rem" }}>
                        {c.title}
                      </div>
                    </div>

                    {c.is_expired ? (
                      <span className="cpn-status-badge cpn-status-expired">
                        Expired
                      </span>
                    ) : c.is_active ? (
                      <span className="cpn-status-badge cpn-status-active">
                        Active
                      </span>
                    ) : (
                      <span className="cpn-status-badge cpn-status-inactive">
                        Inactive
                      </span>
                    )}
                  </div>

                  <div className="cpn-mobile-kv-grid">
                    <div className="cpn-mobile-kv">
                      <span className="cpn-mobile-kv-label">Discount</span>
                      <span className="cpn-mobile-kv-val">
                        {formatDiscountSummary(c)}
                      </span>
                    </div>
                    <div className="cpn-mobile-kv">
                      <span className="cpn-mobile-kv-label">Min. Order</span>
                      <span className="cpn-mobile-kv-val">
                        {Number(c.min_order_amount) > 0
                          ? formatNaira(c.min_order_amount)
                          : "None"}
                      </span>
                    </div>
                    <div className="cpn-mobile-kv">
                      <span className="cpn-mobile-kv-label">Eligibility</span>
                      <span className="cpn-mobile-kv-val">
                        {formatScopeSummary(c)}
                      </span>
                    </div>
                    <div className="cpn-mobile-kv">
                      <span className="cpn-mobile-kv-label">Expires</span>
                      <span className="cpn-mobile-kv-val">
                        {formatDateDisplay(c.expires_at)}
                      </span>
                    </div>
                  </div>

                  <div className="cpn-mobile-actions">
                    <button
                      type="button"
                      className="cpn-btn cpn-btn-sm"
                      onClick={() => handleInspectCoupon(c)}
                    >
                      View
                    </button>
                    <button
                      type="button"
                      className="cpn-btn cpn-btn-sm"
                      onClick={() => handleOpenEditModal(c)}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ════════════════════════════════════════════════════════════════
          MODAL 1: CLEAN STEP-BY-STEP CREATE / EDIT COUPON MODAL
          ════════════════════════════════════════════════════════════════ */}
      {formModalOpen && (
        <div
          className="cpn-modal-backdrop"
          onClick={() => !savingCoupon && setFormModalOpen(false)}
        >
          <form
            className="cpn-modal"
            onSubmit={handleSaveCoupon}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cpn-modal-header">
              <h2 className="cpn-modal-title">
                {editingCoupon
                  ? `Edit Coupon (${editingCoupon.code})`
                  : "New Promotional Coupon"}
              </h2>
              <button
                type="button"
                className="cpn-modal-close"
                onClick={() => !savingCoupon && setFormModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="cpn-modal-body">
                {/* SECTION 1: BASIC DETAILS */}
                <div className="cpn-form-section">
                  <h3 className="cpn-section-heading">1. Coupon Details</h3>

                  <div className="cpn-form-grid-2">
                    <div className="cpn-field">
                      <label className="cpn-label">
                        Coupon Code<span className="cpn-label-req">*</span>
                      </label>
                      <input
                        type="text"
                        className="cpn-input"
                        placeholder="e.g. WELCOME20"
                        value={formCode}
                        onChange={(e) =>
                          setFormCode(e.target.value.toUpperCase())
                        }
                        required
                      />
                    </div>

                    <div className="cpn-field">
                      <label className="cpn-label">
                        Coupon Title<span className="cpn-label-req">*</span>
                      </label>
                      <input
                        type="text"
                        className="cpn-input"
                        placeholder="e.g. 20% Off First Order"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="cpn-field">
                    <label className="cpn-label">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      className="cpn-input"
                      placeholder="Short note shown to customers at checkout..."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </div>
                </div>

                {/* SECTION 2: DISCOUNT & ORDER VALUE */}
                <div className="cpn-form-section">
                  <h3 className="cpn-section-heading">2. Discount Value</h3>

                  <div className="cpn-segmented-3">
                    <button
                      type="button"
                      className={`cpn-segment-card ${
                        formDiscountType === "percentage" ? "selected" : ""
                      }`}
                      onClick={() => setFormDiscountType("percentage")}
                    >
                      Percentage (%)
                    </button>
                    <button
                      type="button"
                      className={`cpn-segment-card ${
                        formDiscountType === "fixed" ? "selected" : ""
                      }`}
                      onClick={() => setFormDiscountType("fixed")}
                    >
                      Fixed Amount (₦)
                    </button>
                    <button
                      type="button"
                      className={`cpn-segment-card ${
                        formDiscountType === "free_delivery" ? "selected" : ""
                      }`}
                      onClick={() => setFormDiscountType("free_delivery")}
                    >
                      Free Delivery
                    </button>
                  </div>

                  {formDiscountType === "percentage" && (
                    <div className="cpn-form-grid-2">
                      <div className="cpn-field">
                        <label className="cpn-label">
                          Percentage Off (%)<span className="cpn-label-req">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="1"
                          max="100"
                          className="cpn-input"
                          placeholder="e.g. 20"
                          value={formDiscountValue}
                          onChange={(e) => setFormDiscountValue(e.target.value)}
                          required
                        />
                      </div>

                      <div className="cpn-field">
                        <label className="cpn-label">
                          Maximum Discount Cap (₦, Optional)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="cpn-input"
                          placeholder="No cap if blank"
                          value={formMaxDiscountAmount}
                          onChange={(e) =>
                            setFormMaxDiscountAmount(e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}

                  {formDiscountType === "fixed" && (
                    <div className="cpn-form-grid-2">
                      <div className="cpn-field">
                        <label className="cpn-label">
                          Amount Off (₦)<span className="cpn-label-req">*</span>
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="1"
                          className="cpn-input"
                          placeholder="e.g. 1500"
                          value={formDiscountValue}
                          onChange={(e) => setFormDiscountValue(e.target.value)}
                          required
                        />
                      </div>

                      <div className="cpn-field">
                        <label className="cpn-label">
                          Minimum Order Subtotal (₦)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="cpn-input"
                          placeholder="0"
                          value={formMinOrderAmount}
                          onChange={(e) => setFormMinOrderAmount(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {formDiscountType !== "fixed" && (
                    <div className="cpn-form-grid-2">
                      <div className="cpn-field">
                        <label className="cpn-label">
                          Minimum Order Subtotal (₦)
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          className="cpn-input"
                          placeholder="0"
                          value={formMinOrderAmount}
                          onChange={(e) => setFormMinOrderAmount(e.target.value)}
                        />
                      </div>

                      <div className="cpn-field">
                        <label className="cpn-label">Status</label>
                        <select
                          className="cpn-select"
                          value={formIsActive ? "true" : "false"}
                          onChange={(e) =>
                            setFormIsActive(e.target.value === "true")
                          }
                        >
                          <option value="true">Active</option>
                          <option value="false">Inactive</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* SECTION 3: WHO CAN USE IT & LIMITS */}
                <div className="cpn-form-section">
                  <h3 className="cpn-section-heading">
                    3. Eligibility & Limits
                  </h3>

                  <div className="cpn-segmented-3">
                    <button
                      type="button"
                      className={`cpn-segment-card ${
                        formCouponType === "general" ? "selected" : ""
                      }`}
                      onClick={() => setFormCouponType("general")}
                    >
                      Everyone
                    </button>
                    <button
                      type="button"
                      className={`cpn-segment-card ${
                        formCouponType === "location_based" ? "selected" : ""
                      }`}
                      onClick={() => setFormCouponType("location_based")}
                    >
                      Specific Cities
                    </button>
                    <button
                      type="button"
                      className={`cpn-segment-card ${
                        formCouponType === "user_based" ? "selected" : ""
                      }`}
                      onClick={() => setFormCouponType("user_based")}
                    >
                      Specific Users
                    </button>
                  </div>

                  {/* Interactive City Selector */}
                  {formCouponType === "location_based" && (
                    <div className="cpn-field">
                      <label className="cpn-label">
                        Select Eligible Cities<span className="cpn-label-req">*</span>
                      </label>
                      <div className="cpn-cities-grid">
                        {allDisplayCities.map((city) => {
                          const isSelected = formSelectedCities.some(
                            (c) => c.toLowerCase() === city.toLowerCase()
                          );
                          return (
                            <button
                              key={city}
                              type="button"
                              className={`cpn-city-pill ${
                                isSelected ? "active" : ""
                              }`}
                              onClick={() => toggleCitySelection(city)}
                            >
                              {isSelected && <Check size={12} />}
                              {city}
                            </button>
                          );
                        })}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          marginTop: "6px",
                        }}
                      >
                        <input
                          type="text"
                          className="cpn-input"
                          placeholder="Or type another city name..."
                          value={formCustomCityInput}
                          onChange={(e) =>
                            setFormCustomCityInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddCustomCity();
                            }
                          }}
                        />
                        <button
                          type="button"
                          className="cpn-btn"
                          onClick={handleAddCustomCity}
                        >
                          Add City
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Interactive User Selector */}
                  {formCouponType === "user_based" && (
                    <div className="cpn-field">
                      <label className="cpn-label">
                        Select Eligible Users ({formTargetUsers.length} selected)
                        <span className="cpn-label-req">*</span>
                      </label>
                      <div className="cpn-picker-box">
                        <div className="cpn-picker-top">
                          <input
                            type="text"
                            className="cpn-input"
                            placeholder="Search user by name or email..."
                            value={userSearchText}
                            onChange={(e) => setUserSearchText(e.target.value)}
                          />
                        </div>

                        {formTargetUsers.length > 0 && (
                          <div className="cpn-picker-chips">
                            {formTargetUsers.map((uid) => {
                              const u = usersList.find(
                                (item) => Number(item.id) === Number(uid)
                              );
                              return (
                                <span key={uid} className="cpn-picker-chip">
                                  {u ? u.name : `User #${uid}`}
                                  <button
                                    type="button"
                                    style={{
                                      background: "none",
                                      border: "none",
                                      cursor: "pointer",
                                      padding: 0,
                                      display: "inline-flex",
                                    }}
                                    onClick={() => toggleTargetUserInForm(uid)}
                                  >
                                    <X size={11} />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <div className="cpn-picker-list">
                          {filteredPickerUsers.map((u) => {
                            const isSelected = formTargetUsers.includes(
                              Number(u.id)
                            );
                            return (
                              <div
                                key={u.id}
                                className={`cpn-picker-option ${
                                  isSelected ? "selected" : ""
                                }`}
                                onClick={() => toggleTargetUserInForm(u.id)}
                              >
                                <span>
                                  {u.name} {u.email ? `(${u.email})` : ""}
                                </span>
                                {isSelected && (
                                  <Check size={13} color="#16a34a" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="cpn-form-grid-2">
                    <div className="cpn-field">
                      <label className="cpn-label">
                        Total Usage Limit (Optional)
                      </label>
                      <input
                        type="number"
                        min="1"
                        className="cpn-input"
                        placeholder="Unlimited if blank"
                        value={formMaxTotalUses}
                        onChange={(e) => setFormMaxTotalUses(e.target.value)}
                      />
                    </div>

                    <div className="cpn-field">
                      <label className="cpn-label">Uses Per Customer</label>
                      <input
                        type="number"
                        min="1"
                        className="cpn-input"
                        value={formMaxUsesPerUser}
                        onChange={(e) => setFormMaxUsesPerUser(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="cpn-form-grid-2">
                    <div className="cpn-field">
                      <label className="cpn-label">
                        Start Date (Optional)
                      </label>
                      <input
                        type="date"
                        className="cpn-input"
                        value={formStartsAt}
                        onChange={(e) => setFormStartsAt(e.target.value)}
                      />
                    </div>

                    <div className="cpn-field">
                      <label className="cpn-label">
                        Expiry Date (Optional)
                      </label>
                      <input
                        type="date"
                        className="cpn-input"
                        value={formExpiresAt}
                        onChange={(e) => setFormExpiresAt(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="cpn-modal-footer">
                <button
                  type="button"
                  className="cpn-btn"
                  onClick={() => setFormModalOpen(false)}
                  disabled={savingCoupon}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cpn-btn cpn-btn-primary"
                  disabled={savingCoupon}
                >
                  {savingCoupon
                    ? "Saving..."
                    : editingCoupon
                    ? "Save Changes"
                    : "Create Coupon"}
                </button>
              </div>
          </form>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 2: INSPECT COUPON DETAILS (`GET /api/coupons/{id}/`)
          ════════════════════════════════════════════════════════════════ */}
      {inspectCoupon && (
        <div
          className="cpn-modal-backdrop"
          onClick={() => setInspectCoupon(null)}
        >
          <div
            className="cpn-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cpn-modal-header">
              <h2 className="cpn-modal-title">Coupon Details</h2>
              <button
                type="button"
                className="cpn-modal-close"
                onClick={() => setInspectCoupon(null)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="cpn-modal-body">
              <div className="cpn-receipt-box">
                <div className="cpn-receipt-hero">
                  <div>
                    <span className="cpn-code-btn">{inspectCoupon.code}</span>
                    <div
                      style={{
                        fontSize: "1rem",
                        fontWeight: 700,
                        color: "#0f172a",
                        marginTop: "6px",
                      }}
                    >
                      {inspectCoupon.title}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    {inspectCoupon.is_expired ? (
                      <span className="cpn-status-badge cpn-status-expired">
                        Expired
                      </span>
                    ) : inspectCoupon.is_active ? (
                      <span className="cpn-status-badge cpn-status-active">
                        Active
                      </span>
                    ) : (
                      <span className="cpn-status-badge cpn-status-inactive">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>

                <div className="cpn-receipt-kv-grid">
                  <div className="cpn-receipt-kv-item">
                    <span className="cpn-receipt-kv-label">Discount</span>
                    <span className="cpn-receipt-kv-val">
                      {formatDiscountSummary(inspectCoupon)}
                    </span>
                  </div>

                  <div className="cpn-receipt-kv-item">
                    <span className="cpn-receipt-kv-label">Minimum Order</span>
                    <span className="cpn-receipt-kv-val">
                      {Number(inspectCoupon.min_order_amount) > 0
                        ? formatNaira(inspectCoupon.min_order_amount)
                        : "No minimum"}
                    </span>
                  </div>

                  <div className="cpn-receipt-kv-item">
                    <span className="cpn-receipt-kv-label">
                      Max Discount Cap
                    </span>
                    <span className="cpn-receipt-kv-val">
                      {inspectCoupon.max_discount_amount
                        ? formatNaira(inspectCoupon.max_discount_amount)
                        : "None"}
                    </span>
                  </div>

                  <div className="cpn-receipt-kv-item">
                    <span className="cpn-receipt-kv-label">Redemptions</span>
                    <span className="cpn-receipt-kv-val">
                      {inspectCoupon.current_total_uses}
                      {inspectCoupon.max_total_uses
                        ? ` / ${inspectCoupon.max_total_uses}`
                        : " (Unlimited)"}
                    </span>
                  </div>

                  <div className="cpn-receipt-kv-item">
                    <span className="cpn-receipt-kv-label">Eligibility</span>
                    <span className="cpn-receipt-kv-val">
                      {formatScopeSummary(inspectCoupon)}
                    </span>
                  </div>

                  <div className="cpn-receipt-kv-item">
                    <span className="cpn-receipt-kv-label">Expires</span>
                    <span className="cpn-receipt-kv-val">
                      {formatDateDisplay(inspectCoupon.expires_at)}
                    </span>
                  </div>

                  {inspectCoupon.description && (
                    <div className="cpn-receipt-kv-item full-width">
                      <span className="cpn-receipt-kv-label">Description</span>
                      <span className="cpn-receipt-kv-val">
                        {inspectCoupon.description}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="cpn-modal-footer">
              <button
                type="button"
                className="cpn-btn"
                onClick={() => handleToggleCouponActive(inspectCoupon)}
              >
                {inspectCoupon.is_active ? "Deactivate" : "Activate"}
              </button>
              <button
                type="button"
                className="cpn-btn"
                onClick={() => {
                  const target = inspectCoupon;
                  setInspectCoupon(null);
                  handleOpenValidator(target.code);
                }}
              >
                Test Code
              </button>
              <button
                type="button"
                className="cpn-btn"
                onClick={() => {
                  const target = inspectCoupon;
                  setInspectCoupon(null);
                  handleOpenEditModal(target);
                }}
              >
                Edit
              </button>
              <button
                type="button"
                className="cpn-btn cpn-btn-primary"
                onClick={() => setInspectCoupon(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          MODAL 3: VALIDATE & SIMULATE COUPON (`POST /api/coupons/validate/`)
          ════════════════════════════════════════════════════════════════ */}
      {validateModalOpen && (
        <div
          className="cpn-modal-backdrop"
          onClick={() => !validating && setValidateModalOpen(false)}
        >
          <form
            className="cpn-modal cpn-modal-sm"
            onSubmit={handleRunValidation}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cpn-modal-header">
              <h2 className="cpn-modal-title">Test Coupon Code</h2>
              <button
                type="button"
                className="cpn-modal-close"
                onClick={() => !validating && setValidateModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="cpn-modal-body">
                <div className="cpn-form-grid-2">
                  <div className="cpn-field">
                    <label className="cpn-label">
                      Coupon Code<span className="cpn-label-req">*</span>
                    </label>
                    <input
                      type="text"
                      className="cpn-input"
                      placeholder="e.g. WELCOME20"
                      value={simCode}
                      onChange={(e) =>
                        setSimCode(e.target.value.toUpperCase())
                      }
                      required
                    />
                  </div>

                  <div className="cpn-field">
                    <label className="cpn-label">Customer City</label>
                    <input
                      type="text"
                      className="cpn-input"
                      placeholder="e.g. Enugu"
                      value={simCity}
                      onChange={(e) => setSimCity(e.target.value)}
                    />
                  </div>
                </div>

                <div className="cpn-form-grid-2">
                  <div className="cpn-field">
                    <label className="cpn-label">
                      Order Subtotal (₦)<span className="cpn-label-req">*</span>
                    </label>
                    <input
                      type="number"
                      step="any"
                      className="cpn-input"
                      value={simSubtotal}
                      onChange={(e) => setSimSubtotal(e.target.value)}
                      required
                    />
                  </div>

                  <div className="cpn-field">
                    <label className="cpn-label">Delivery Fee (₦)</label>
                    <input
                      type="number"
                      step="any"
                      className="cpn-input"
                      value={simDeliveryFee}
                      onChange={(e) => setSimDeliveryFee(e.target.value)}
                    />
                  </div>
                </div>

                {validationResult && (
                  <div
                    className="cpn-receipt-box"
                    style={{
                      borderColor: validationResult.valid
                        ? "#bbf7d0"
                        : "#fecaca",
                    }}
                  >
                    <div
                      className="cpn-receipt-hero"
                      style={{
                        background: validationResult.valid
                          ? "#f0fdf4"
                          : "#fef2f2",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: "0.82rem",
                          color: validationResult.valid ? "#166534" : "#991b1b",
                        }}
                      >
                        {validationResult.message}
                      </span>
                      <span
                        className={`cpn-status-badge ${
                          validationResult.valid
                            ? "cpn-status-active"
                            : "cpn-status-expired"
                        }`}
                      >
                        {validationResult.valid ? "Eligible" : "Rejected"}
                      </span>
                    </div>

                    {validationResult.valid && validationResult.data && (
                      <div className="cpn-receipt-kv-grid">
                        {validationResult.data.discount !== undefined && (
                          <div className="cpn-receipt-kv-item">
                            <span className="cpn-receipt-kv-label">
                              Discount Applied
                            </span>
                            <span className="cpn-receipt-kv-val">
                              {formatNaira(validationResult.data.discount)}
                            </span>
                          </div>
                        )}
                        {validationResult.data.final_total !== undefined && (
                          <div className="cpn-receipt-kv-item">
                            <span className="cpn-receipt-kv-label">
                              Final Total
                            </span>
                            <span className="cpn-receipt-kv-val">
                              {formatNaira(validationResult.data.final_total)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="cpn-modal-footer">
                <button
                  type="button"
                  className="cpn-btn"
                  onClick={() => setValidateModalOpen(false)}
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="cpn-btn cpn-btn-primary"
                  disabled={validating}
                >
                  {validating ? "Checking..." : "Check Eligibility"}
                </button>
              </div>
          </form>
        </div>
      )}
    </div>
  );
}
