// src/pages/WarehousesPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Warehouse as WarehouseIcon,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Trash2,
  ExternalLink,
  ArrowRight,
  X,
  AlertCircle,
  Navigation,
  Power,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./Warehouses.css";

/**
 * Safely extract an array from various backend response wrappers:
 * - [...]
 * - { data: [...] }
 * - { results: [...] }
 * - { data: { results: [...] } }
 * - { warehouses: [...] }
 */
export function extractWarehouseArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (payload.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.results)) return payload.data.results;
    if (Array.isArray(payload.data.warehouses)) return payload.data.warehouses;
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }
  if (Array.isArray(payload.warehouses)) return payload.warehouses;
  return [];
}

/**
 * Safely extract a single object from `{ data: {...} }` or direct `{...}`
 */
export function extractWarehouseObject(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return payload.data;
  }
  return payload;
}

export function formatApiError(err, fallback = "Operation failed. Please try again.") {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === "string") return data;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data.error === "string" && data.error.trim()) return data.error;
  const fieldErrors = [];
  const source = data.errors && typeof data.errors === "object" ? data.errors : data;
  Object.entries(source).forEach(([key, val]) => {
    if (["isSuccessful", "success", "status", "status_code"].includes(key)) return;
    if (Array.isArray(val)) {
      fieldErrors.push(`${key}: ${val.join(", ")}`);
    } else if (typeof val === "string") {
      fieldErrors.push(`${key}: ${val}`);
    }
  });
  if (fieldErrors.length > 0) return fieldErrors.join(" | ");
  return fallback;
}

export const QUICK_COORD_PRESETS = [
  { label: "Enugu", lat: 6.4531, lng: 7.5106 },
  { label: "Lagos Island / VI", lat: 6.4281, lng: 3.4219 },
  { label: "Lekki Phase 1", lat: 6.4474, lng: 3.4723 },
  { label: "Ikeja, Lagos", lat: 6.6018, lng: 3.3515 },
  { label: "Wuse II, Abuja", lat: 9.0765, lng: 7.4762 },
  { label: "Port Harcourt", lat: 4.8156, lng: 7.0498 },
];

export default function WarehousesPage() {
  const api = useMemo(() => getAxiosInstance(), []);
  const navigate = useNavigate();

  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Filters & view state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | inactive
  const [sortBy, setSortBy] = useState("name-asc");
  const [viewMode, setViewMode] = useState("grid"); // grid | table

  // Create / Edit modal state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formLatitude, setFormLatitude] = useState("");
  const [formLongitude, setFormLongitude] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [locatingGps, setLocatingGps] = useState(false);

  // Toggling active state per row
  const [togglingId, setTogglingId] = useState(null);

  // Delete modal state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const fetchWarehouses = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/admin/warehouses/", {
        params: { page: 1, page_size: 100 },
      });
      const list = extractWarehouseArray(res.data);
      setWarehouses(list);
    } catch (err) {
      setError(formatApiError(err, "Failed to load warehouses."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    fetchWarehouses();
  }, [fetchWarehouses]);

  // Metrics
  const stats = useMemo(() => {
    const total = warehouses.length;
    const active = warehouses.filter((w) => w.is_active !== false).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [warehouses]);

  // Filtered + Sorted list
  const filteredWarehouses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = warehouses.filter((w) => {
      const isActive = w.is_active !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;

      if (!q) return true;
      const name = String(w.name || "").toLowerCase();
      const address = String(w.address || "").toLowerCase();
      const phone = String(w.contact_phone || "").toLowerCase();
      const email = String(w.contact_email || "").toLowerCase();

      return (
        name.includes(q) ||
        address.includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === "name-asc") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (sortBy === "name-desc") {
        return String(b.name || "").localeCompare(String(a.name || ""));
      }
      if (sortBy === "newest") {
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      }
      if (sortBy === "updated") {
        return (
          new Date(b.updated_at || 0).getTime() -
          new Date(a.updated_at || 0).getTime()
        );
      }
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });

    return list;
  }, [warehouses, searchQuery, statusFilter, sortBy]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingWarehouse(null);
    setFormName("");
    setFormAddress("");
    setFormLatitude("");
    setFormLongitude("");
    setFormPhone("");
    setFormEmail("");
    setFormIsActive(true);
    setFormError("");
    setFormModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (wh) => {
    setEditingWarehouse(wh);
    setFormName(wh.name || "");
    setFormAddress(wh.address || "");
    setFormLatitude(
      wh.latitude !== undefined && wh.latitude !== null ? String(wh.latitude) : ""
    );
    setFormLongitude(
      wh.longitude !== undefined && wh.longitude !== null
        ? String(wh.longitude)
        : ""
    );
    setFormPhone(wh.contact_phone || "");
    setFormEmail(wh.contact_email || "");
    setFormIsActive(wh.is_active !== false);
    setFormError("");
    setFormModalOpen(true);
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
        setFormLatitude(String(Number(pos.coords.latitude.toFixed(6))));
        setFormLongitude(String(Number(pos.coords.longitude.toFixed(6))));
        setLocatingGps(false);
      },
      (err) => {
        setFormError(
          err?.message || "Unable to retrieve current location coordinates."
        );
        setLocatingGps(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSaveWarehouse = async (e) => {
    e.preventDefault();
    setFormError("");

    const trimmedName = formName.trim();
    const trimmedAddress = formAddress.trim();
    const latNum = parseFloat(formLatitude);
    const lngNum = parseFloat(formLongitude);

    if (!trimmedName) {
      setFormError("Warehouse name is required.");
      return;
    }
    if (!trimmedAddress) {
      setFormError("Street address is required.");
      return;
    }
    if (Number.isNaN(latNum) || latNum < -90 || latNum > 90) {
      setFormError("Please enter a valid latitude between -90 and 90.");
      return;
    }
    if (Number.isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      setFormError("Please enter a valid longitude between -180 and 180.");
      return;
    }

    const payload = {
      name: trimmedName,
      address: trimmedAddress,
      latitude: latNum,
      longitude: lngNum,
      contact_phone: formPhone.trim(),
      contact_email: formEmail.trim(),
      is_active: Boolean(formIsActive),
    };

    setFormSubmitting(true);
    try {
      if (editingWarehouse) {
        const res = await api.patch(
          `/admin/warehouses/${editingWarehouse.id}/`,
          payload
        );
        const updated = extractWarehouseObject(res.data) || {
          ...editingWarehouse,
          ...payload,
        };
        setWarehouses((prev) =>
          prev.map((w) => (w.id === editingWarehouse.id ? { ...w, ...updated } : w))
        );
        setNotice(`"${updated.name}" updated.`);
      } else {
        const res = await api.post("/admin/warehouses/", payload);
        const created = extractWarehouseObject(res.data);
        if (created && created.id) {
          setWarehouses((prev) => [created, ...prev]);
        } else {
          await fetchWarehouses();
        }
        setNotice(`"${trimmedName}" added.`);
      }
      setFormModalOpen(false);
    } catch (err) {
      setFormError(formatApiError(err, "Failed to save warehouse."));
    } finally {
      setFormSubmitting(false);
    }
  };

  // Instant toggle `is_active` via PATCH /admin/warehouses/{id}/
  const handleToggleActive = async (wh) => {
    const nextActive = !(wh.is_active !== false);
    setTogglingId(wh.id);
    setError("");
    try {
      const payload = {
        name: wh.name,
        address: wh.address,
        latitude: Number(wh.latitude),
        longitude: Number(wh.longitude),
        contact_phone: wh.contact_phone || "",
        contact_email: wh.contact_email || "",
        is_active: nextActive,
      };
      const res = await api.patch(`/admin/warehouses/${wh.id}/`, payload);
      const updated = extractWarehouseObject(res.data) || {
        ...wh,
        is_active: nextActive,
      };
      setWarehouses((prev) =>
        prev.map((item) => (item.id === wh.id ? { ...item, ...updated } : item))
      );
      setNotice(
        `"${wh.name}" is now ${nextActive ? "active and accepting orders" : "paused"}.`
      );
    } catch (err) {
      setError(formatApiError(err, "Failed to update warehouse status."));
    } finally {
      setTogglingId(null);
    }
  };

  // Deactivate instead of deleting (from delete modal)
  const handleDeactivateInstead = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      const payload = {
        name: deleteTarget.name,
        address: deleteTarget.address,
        latitude: Number(deleteTarget.latitude),
        longitude: Number(deleteTarget.longitude),
        contact_phone: deleteTarget.contact_phone || "",
        contact_email: deleteTarget.contact_email || "",
        is_active: false,
      };
      const res = await api.patch(
        `/admin/warehouses/${deleteTarget.id}/`,
        payload
      );
      const updated = extractWarehouseObject(res.data) || {
        ...deleteTarget,
        is_active: false,
      };
      setWarehouses((prev) =>
        prev.map((item) =>
          item.id === deleteTarget.id ? { ...item, ...updated } : item
        )
      );
      setNotice(`"${deleteTarget.name}" was paused. All stock history is kept.`);
      setDeleteTarget(null);
    } catch (err) {
      setError(formatApiError(err, "Failed to pause warehouse."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // Hard Delete via DELETE /admin/warehouses/{id}/
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      await api.delete(`/admin/warehouses/${deleteTarget.id}/`);
      setWarehouses((prev) => prev.filter((w) => w.id !== deleteTarget.id));
      setNotice(`"${deleteTarget.name}" was deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      setError(formatApiError(err, "Failed to delete warehouse."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="wh-page">
      {/* Top Header */}
      <div className="wh-header">
        <div className="wh-title-group">
          <h1 className="wh-title">Warehouses</h1>
          <p className="wh-subtitle">
            Manage fulfillment locations, update stock levels, and view customer orders routed to each warehouse.
          </p>
        </div>

        <div className="wh-header-actions">
          <button
            type="button"
            className="wh-btn wh-btn-secondary"
            onClick={fetchWarehouses}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            Refresh
          </button>
          <button
            type="button"
            className="wh-btn wh-btn-primary"
            onClick={openCreateModal}
          >
            <Plus size={15} />
            Add Warehouse
          </button>
        </div>
      </div>

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

      {/* Filter & Search Toolbar */}
      <div className="wh-toolbar">
        <div className="wh-toolbar-left">
          <div className="wh-search-wrap" style={{ minWidth: 260 }}>
            <Search size={15} className="wh-search-icon" />
            <input
              type="text"
              className="wh-search-input"
              placeholder="Search by name, address, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="wh-search-clear"
                onClick={() => setSearchQuery("")}
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="wh-filter-pills">
            <button
              type="button"
              className={`wh-filter-pill${statusFilter === "all" ? " active" : ""}`}
              onClick={() => setStatusFilter("all")}
            >
              All ({stats.total})
            </button>
            <button
              type="button"
              className={`wh-filter-pill${statusFilter === "active" ? " active" : ""}`}
              onClick={() => setStatusFilter("active")}
            >
              Active ({stats.active})
            </button>
            <button
              type="button"
              className={`wh-filter-pill${statusFilter === "inactive" ? " active" : ""}`}
              onClick={() => setStatusFilter("inactive")}
            >
              Paused ({stats.inactive})
            </button>
          </div>
        </div>

        <div className="wh-toolbar-right">
          <select
            className="wh-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort warehouses"
          >
            <option value="name-asc">Sort: Name (A–Z)</option>
            <option value="name-desc">Sort: Name (Z–A)</option>
            <option value="newest">Sort: Newest Added</option>
            <option value="updated">Sort: Recently Updated</option>
          </select>

          <div className="wh-filter-pills">
            <button
              type="button"
              className={`wh-filter-pill${viewMode === "grid" ? " active" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              Cards
            </button>
            <button
              type="button"
              className={`wh-filter-pill${viewMode === "table" ? " active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Loading Shimmer State */}
      {loading ? (
        viewMode === "grid" ? (
          <div className="wh-grid">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="wh-card" style={{ pointerEvents: "none" }}>
                <div className="wh-card-header">
                  <div className="wh-card-identity">
                    <div
                      className="wh-shimmer"
                      style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        className="wh-shimmer"
                        style={{ width: "65%", height: 16, marginBottom: 6 }}
                      />
                      <div
                        className="wh-shimmer"
                        style={{ width: "40%", height: 12 }}
                      />
                    </div>
                  </div>
                  <div
                    className="wh-shimmer"
                    style={{ width: 64, height: 22, borderRadius: 999 }}
                  />
                </div>

                <div className="wh-card-details">
                  <div
                    className="wh-shimmer"
                    style={{ width: "90%", height: 13, marginBottom: 6 }}
                  />
                  <div className="wh-shimmer" style={{ width: "55%", height: 13 }} />
                </div>

                <div className="wh-card-footer">
                  <div
                    className="wh-shimmer"
                    style={{ width: 140, height: 32, borderRadius: 7 }}
                  />
                  <div style={{ display: "flex", gap: 6 }}>
                    <div
                      className="wh-shimmer"
                      style={{ width: 60, height: 32, borderRadius: 7 }}
                    />
                    <div
                      className="wh-shimmer"
                      style={{ width: 32, height: 32, borderRadius: 7 }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="wh-table-card">
            <div className="wh-table-scroll">
              <table className="wh-table">
                <thead>
                  <tr>
                    <th>Location Name</th>
                    <th>Street Address</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="wh-shimmer" style={{ width: 150, height: 15 }} />
                      </td>
                      <td>
                        <div className="wh-shimmer" style={{ width: 220, height: 14 }} />
                      </td>
                      <td>
                        <div className="wh-shimmer" style={{ width: 130, height: 14 }} />
                      </td>
                      <td>
                        <div
                          className="wh-shimmer"
                          style={{ width: 68, height: 22, borderRadius: 999 }}
                        />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div
                          className="wh-shimmer"
                          style={{
                            width: 160,
                            height: 30,
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
          </div>
        )
      ) : filteredWarehouses.length === 0 ? (
        <div className="wh-empty wh-empty-card">
          <div className="wh-empty-icon">
            <WarehouseIcon size={22} />
          </div>
          <h3>
            {warehouses.length === 0
              ? "No warehouses added yet"
              : "No warehouses match your search"}
          </h3>
          <p>
            {warehouses.length === 0
              ? "Add your first warehouse location to manage ingredient stock, meal packs, and customer order dispatches."
              : "Try clearing your search or switching the filter above."}
          </p>
          {warehouses.length === 0 ? (
            <button
              type="button"
              className="wh-btn wh-btn-primary"
              onClick={openCreateModal}
              style={{ marginTop: 6 }}
            >
              <Plus size={15} />
              Add First Warehouse
            </button>
          ) : (
            <button
              type="button"
              className="wh-btn wh-btn-secondary"
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
              }}
              style={{ marginTop: 6 }}
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="wh-grid">
          {filteredWarehouses.map((wh) => {
            const isActive = wh.is_active !== false;
            const mapsUrl =
              wh.latitude !== undefined && wh.longitude !== undefined
                ? `https://www.google.com/maps?q=${wh.latitude},${wh.longitude}`
                : null;

            return (
              <div
                key={wh.id}
                className={`wh-card${isActive ? "" : " inactive"}`}
              >
                <div className="wh-card-main">
                  {/* Header: Warehouse Name + Status Badge */}
                  <div className="wh-card-header">
                    <div className="wh-card-title-wrap">
                      <h3 className="wh-card-title">
                        <Link to={`/warehouses/${wh.id}`}>
                          {wh.name || "Unnamed Warehouse"}
                        </Link>
                      </h3>
                      <div className="wh-card-sub">
                        {isActive
                          ? "Accepting customer orders"
                          : "Paused from order routing"}
                      </div>
                    </div>

                    <span
                      className={`wh-status-badge ${
                        isActive ? "active" : "inactive"
                      }`}
                    >
                      <span className="wh-status-dot" />
                      {isActive ? "Active" : "Paused"}
                    </span>
                  </div>

                  {/* Clean Info Rows */}
                  <div className="wh-card-info-list">
                    <div className="wh-card-address-wrap">
                      <span className="wh-card-address-text">
                        {wh.address || "No street address provided"}
                      </span>
                      {mapsUrl && (
                        <a
                          href={mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wh-map-link"
                        >
                          <span>View Map</span>
                          <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                    {(wh.contact_phone || wh.contact_email) && (
                      <div className="wh-card-contact-row">
                        {wh.contact_phone && (
                          <span className="wh-card-contact-item">
                            <span>{wh.contact_phone}</span>
                          </span>
                        )}
                        {wh.contact_phone && wh.contact_email && (
                          <span style={{ color: "#cbd5e1" }}>·</span>
                        )}
                        {wh.contact_email && (
                          <span className="wh-card-contact-item">
                            <span>{wh.contact_email}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Single-Row Footer */}
                <div className="wh-card-footer">
                  <Link
                    to={`/warehouses/${wh.id}`}
                    className="wh-btn wh-btn-primary wh-btn-sm wh-card-open-btn"
                  >
                    <span>Manage Inventory &amp; Orders</span>
                  </Link>

                  <div className="wh-card-actions-right">
                    <button
                      type="button"
                      className="wh-btn wh-btn-secondary wh-btn-sm"
                      onClick={() => openEditModal(wh)}
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className="wh-btn wh-btn-secondary wh-btn-sm"
                      onClick={() => handleToggleActive(wh)}
                      disabled={togglingId === wh.id}
                      title={
                        isActive
                          ? "Temporarily pause orders for this location"
                          : "Resume accepting orders"
                      }
                    >
                      {togglingId === wh.id
                        ? "..."
                        : isActive
                        ? "Pause"
                        : "Resume"}
                    </button>

                    <button
                      type="button"
                      className="wh-btn wh-btn-danger-soft wh-btn-sm"
                      onClick={() => setDeleteTarget(wh)}
                      title="Delete warehouse"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="wh-table-card">
          <div className="wh-table-scroll">
            <table className="wh-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Address</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.map((wh) => {
                  const isActive = wh.is_active !== false;
                  const mapsUrl =
                    wh.latitude !== undefined && wh.longitude !== undefined
                      ? `https://www.google.com/maps?q=${wh.latitude},${wh.longitude}`
                      : null;

                  return (
                    <tr key={wh.id}>
                      <td>
                        <div style={{ fontWeight: 700, color: "#0f172a" }}>
                          <Link
                            to={`/warehouses/${wh.id}`}
                            style={{ color: "inherit", textDecoration: "none" }}
                          >
                            {wh.name || "Unnamed Warehouse"}
                          </Link>
                        </div>
                        {wh.updated_at && (
                          <div style={{ fontSize: "0.73rem", color: "#64748b" }}>
                            Updated {new Date(wh.updated_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>

                      <td>
                        <div
                          style={{
                            fontWeight: 500,
                            color: "#1e293b",
                            marginBottom: mapsUrl ? 4 : 0,
                            maxWidth: 360,
                          }}
                        >
                          {wh.address || "—"}
                        </div>
                        {mapsUrl && (
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="wh-map-link"
                          >
                            <Navigation size={11} />
                            <span>View Map</span>
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </td>

                      <td>
                        {wh.contact_phone || wh.contact_email ? (
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                              fontSize: "0.79rem",
                            }}
                          >
                            {wh.contact_phone && <span>{wh.contact_phone}</span>}
                            {wh.contact_email && (
                              <span style={{ color: "#64748b" }}>
                                {wh.contact_email}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "0.78rem" }}>
                            Not set
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`wh-status-badge ${
                            isActive ? "active" : "inactive"
                          }`}
                        >
                          <span className="wh-status-dot" />
                          {isActive ? "Active" : "Paused"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right" }}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="wh-btn wh-btn-primary wh-btn-sm"
                            onClick={() => navigate(`/warehouses/${wh.id}`)}
                          >
                            Open
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            className="wh-btn wh-btn-secondary wh-btn-sm"
                            onClick={() => openEditModal(wh)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="wh-btn wh-btn-secondary wh-btn-sm"
                            onClick={() => handleToggleActive(wh)}
                            disabled={togglingId === wh.id}
                          >
                            {isActive ? "Pause" : "Enable"}
                          </button>
                          <button
                            type="button"
                            className="wh-btn wh-btn-danger-soft wh-btn-sm"
                            onClick={() => setDeleteTarget(wh)}
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

      {/* Create / Edit Warehouse Modal */}
      {formModalOpen && (
        <div
          className="wh-modal-backdrop"
          onClick={() => !formSubmitting && setFormModalOpen(false)}
        >
          <div
            className="wh-modal wh-modal-form"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="wh-modal-header">
              <div className="wh-modal-header-main">
                <h3>
                  {editingWarehouse ? "Edit Warehouse" : "Add New Warehouse"}
                </h3>
                <div className="wh-modal-subtitle">
                  {editingWarehouse
                    ? `Update location, GPS coordinates, and dispatch contact details for ${editingWarehouse.name || "this warehouse"}.`
                    : "Configure warehouse location, GPS coordinates, and dispatch contact details."}
                </div>
              </div>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => !formSubmitting && setFormModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse}>
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
                  onClick={() => setFormModalOpen(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="wh-btn wh-btn-primary"
                  disabled={formSubmitting}
                >
                  {formSubmitting
                    ? "Saving..."
                    : editingWarehouse
                    ? "Save Changes"
                    : "Add Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Pause Warehouse Confirmation Modal */}
      {deleteTarget && (
        <div
          className="wh-modal-backdrop"
          onClick={() => !deleteSubmitting && setDeleteTarget(null)}
        >
          <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
            <div className="wh-modal-header">
              <h3>Remove "{deleteTarget.name}"?</h3>
              <button
                type="button"
                className="wh-modal-close"
                onClick={() => !deleteSubmitting && setDeleteTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="wh-modal-body">
              <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155", lineHeight: 1.55 }}>
                If you only want to stop new orders from going to{" "}
                <strong>{deleteTarget.name}</strong>, we recommend{" "}
                <strong>pausing</strong> it instead so you don't lose its inventory records.
              </p>
              <p style={{ margin: 0, fontSize: "0.82rem", color: "#64748b", lineHeight: 1.5 }}>
                Deleting this warehouse will permanently remove its location and all stock counts assigned to it.
              </p>
            </div>

            <div className="wh-modal-footer">
              <button
                type="button"
                className="wh-btn wh-btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>

              {deleteTarget.is_active !== false && (
                <button
                  type="button"
                  className="wh-btn wh-btn-soft"
                  onClick={handleDeactivateInstead}
                  disabled={deleteSubmitting}
                >
                  <Power size={14} />
                  {deleteSubmitting ? "Updating..." : "Pause Warehouse Instead"}
                </button>
              )}

              <button
                type="button"
                className="wh-btn wh-btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
              >
                <Trash2 size={14} />
                {deleteSubmitting ? "Deleting..." : "Delete Permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
