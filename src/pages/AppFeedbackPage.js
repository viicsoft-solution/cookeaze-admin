// src/pages/AppFeedbackPage.js
import React, { useEffect, useState } from "react";
import { getAxiosInstance } from "../api";
import {
  Search,
  Trash2,
  Mail,
  Calendar,
  MessageSquare,
  ArrowUpDown,
  X,
  Copy,
  Check,
  RefreshCw,
  User,
} from "lucide-react";

export default function AppFeedbackPage() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest"); // "newest" | "oldest"
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [copiedType, setCopiedType] = useState(null); // "email" | "phone" | null

  const axios = getAxiosInstance();

  const fetchFeedback = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get("/app-feedback/");
      // API payload structure: { isSuccessful, message, data: [...] }
      const data = res.data?.data ?? [];
      setFeedback(data);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch app feedback. Please check your credentials or try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeedback();
    // eslint-disable-next-line
  }, []);

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this feedback item? This cannot be undone.")) {
      return;
    }

    setError(null);
    setSuccess(null);
    try {
      await axios.delete(`/app-feedback/${id}/`);
      setFeedback((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Feedback item deleted successfully.");
      if (selectedFeedback?.id === id) {
        setSelectedFeedback(null);
      }
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error(err);
      const apiErrorMsg = err?.response?.data?.message || err?.message || "Failed to delete feedback.";
      setError(`Error from server: ${apiErrorMsg}. (It's possible the DELETE endpoint is restricted or unsupported by the server).`);
      setTimeout(() => setError(null), 6000);
    }
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  // Get initials for avatar display
  const getInitials = (name) => {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  };

  // Format Date beautifully
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };

  // Filter and Sort feedback list
  const filteredFeedback = feedback
    .filter((item) => {
      const query = search.toLowerCase();
      const username = (item.username || "").toLowerCase();
      const email = (item.email || "").toLowerCase();
      const phone = (item.phone_number || "").toLowerCase();
      const description = (item.description || "").toLowerCase();
      return (
        username.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        description.includes(query)
      );
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return sortBy === "newest" ? dateB - dateA : dateA - dateB;
    });

  // Analytics Metrics
  const totalFeedbackCount = feedback.length;
  const uniqueUsersCount = new Set(feedback.map((f) => f.user)).size;
  const recentSubmissionsCount = feedback.filter((f) => {
    if (!f.created_at) return false;
    const date = new Date(f.created_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return date >= thirtyDaysAgo;
  }).length;

  return (
    <div className="container py-4">
      {/* Title & Actions */}
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
        <div>
          <h3 className="mb-1" style={{ fontWeight: 800, color: "var(--text-primary)" }}>
            App Feedback
          </h3>
          <p className="text-muted mb-0 small">
            Read, review, and manage feedback submitted by mobile users.
          </p>
        </div>
        <button
          className="btn btn-outline-primary btn-sm d-flex align-items-center gap-2"
          onClick={fetchFeedback}
          disabled={loading}
          id="btn-refresh-feedback"
        >
          <RefreshCw size={14} className={loading ? "spin-animation" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metrics Section */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="card shadow-sm border-0 p-3 h-100" style={{ background: "var(--surface)" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-1">
                  Total Submissions
                </span>
                <span className="h3 mb-0 fw-bold">{totalFeedbackCount}</span>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 44, height: 44, background: "var(--primary-light)", color: "var(--primary)" }}
              >
                <MessageSquare size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm border-0 p-3 h-100" style={{ background: "var(--surface)" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-1">
                  Unique Users
                </span>
                <span className="h3 mb-0 fw-bold">{uniqueUsersCount}</span>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 44, height: 44, background: "rgba(13, 110, 253, 0.08)", color: "#0d6efd" }}
              >
                <User size={20} />
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="card shadow-sm border-0 p-3 h-100" style={{ background: "var(--surface)" }}>
            <div className="d-flex align-items-center justify-content-between">
              <div>
                <span className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-1">
                  Last 30 Days
                </span>
                <span className="h3 mb-0 fw-bold">{recentSubmissionsCount}</span>
              </div>
              <div
                className="rounded-circle d-flex align-items-center justify-content-center"
                style={{ width: 44, height: 44, background: "rgba(25, 135, 84, 0.08)", color: "#198754" }}
              >
                <Calendar size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="alert alert-danger alert-dismissible fade show shadow-sm border-0" role="alert" id="feedback-error-alert">
          <strong>Notice: </strong> {error}
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setError(null)}></button>
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible fade show shadow-sm border-0" role="alert" id="feedback-success-alert">
          {success}
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setSuccess(null)}></button>
        </div>
      )}

      {/* Search and Sort Toolbar */}
      <div className="card shadow-sm border-0 p-3 mb-4" style={{ background: "var(--surface)" }}>
        <div className="row g-2 align-items-center">
          <div className="col-md">
            <div className="input-group">
              <span className="input-group-text bg-transparent border-end-0 text-muted">
                <Search size={16} />
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search feedback by username, email, phone number or content..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                id="search-feedback-input"
              />
              {search && (
                <button
                  className="btn btn-outline-secondary border-start-0 border-end-0"
                  type="button"
                  onClick={() => setSearch("")}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="col-md-auto">
            <div className="d-flex align-items-center gap-2">
              <span className="text-muted small text-nowrap d-flex align-items-center gap-1">
                <ArrowUpDown size={14} />
                Sort:
              </span>
              <select
                className="form-select form-select-sm"
                style={{ minWidth: 140 }}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                id="sort-feedback-select"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeleton & List View */}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" style={{ width: "3rem", height: "3rem" }}>
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="text-muted mt-3">Loading app feedback submissions...</p>
        </div>
      ) : filteredFeedback.length === 0 ? (
        <div className="card shadow-sm border-0 p-5 text-center text-muted">
          <MessageSquare className="mx-auto mb-3 text-muted" size={48} style={{ opacity: 0.5 }} />
          <h5>No Feedback Found</h5>
          <p className="mb-0 small">
            {search
              ? "We couldn't find any feedback matches for your search query."
              : "No feedback submissions have been received from the mobile app yet."}
          </p>
        </div>
      ) : (
        <div className="row g-3">
          {filteredFeedback.map((item) => (
            <div className="col-md-6 col-lg-4" key={item.id}>
              <div
                className="card h-100 shadow-sm border-0 d-flex flex-column"
                style={{ cursor: "pointer", transition: "transform 0.15s ease, box-shadow 0.15s ease" }}
                onClick={() => setSelectedFeedback(item)}
              >
                {/* Card Header */}
                <div className="card-body p-3 flex-grow-1">
                  <div className="d-flex align-items-start gap-3 mb-3">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                      style={{
                        minWidth: 42,
                        height: 42,
                        background: "var(--primary-light)",
                        color: "var(--primary)",
                        fontSize: 14,
                      }}
                    >
                      {getInitials(item.username)}
                    </div>
                    <div className="overflow-hidden">
                      <h6 className="mb-0 text-truncate fw-bold" title={item.username}>
                        {item.username || `User #${item.user}`}
                      </h6>
                      <div className="text-muted small text-truncate" title={item.email}>
                        {item.email || "No email provided"}
                      </div>
                    </div>
                  </div>

                  {/* Feedback Description Preview */}
                  <p
                    className="card-text text-secondary mb-3 small"
                    style={{
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      minHeight: 54,
                    }}
                  >
                    {item.description}
                  </p>

                  {/* Date & Metadata */}
                  <div className="d-flex align-items-center gap-1 text-muted small mt-auto">
                    <Calendar size={12} />
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div
                  className="card-footer bg-transparent border-top-0 p-3 pt-0 d-flex justify-content-between align-items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    className="btn btn-link btn-sm text-primary p-0 text-decoration-none fw-bold"
                    onClick={() => setSelectedFeedback(item)}
                  >
                    View Details
                  </button>
                  <button
                    className="btn btn-outline-danger btn-sm p-1 rounded d-flex align-items-center justify-content-center"
                    style={{ width: 28, height: 28 }}
                    onClick={(e) => handleDelete(item.id, e)}
                    title="Delete Feedback"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Modal Overlay */}
      {selectedFeedback && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelectedFeedback(null)}
          tabIndex="-1"
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-content border-0 shadow-lg" style={{ borderRadius: "var(--radius-lg)" }}>
              {/* Modal Header */}
              <div className="modal-header border-bottom-0 pb-0">
                <h5 className="modal-title fw-bold">Feedback Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => setSelectedFeedback(null)}
                ></button>
              </div>

              {/* Modal Body */}
              <div className="modal-body p-4">
                <div className="row g-4">
                  {/* Sender Profile Details */}
                  <div className="col-md-5 border-end border-light">
                    <div className="d-flex align-items-center gap-3 mb-4">
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center fw-bold"
                        style={{
                          width: 56,
                          height: 56,
                          background: "var(--primary-light)",
                          color: "var(--primary)",
                          fontSize: 18,
                        }}
                      >
                        {getInitials(selectedFeedback.username)}
                      </div>
                      <div>
                        <h5 className="mb-0 fw-bold">{selectedFeedback.username || "Anonymous"}</h5>
                        <span className="text-muted small">User ID: #{selectedFeedback.user}</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-1">
                        Email Address
                      </label>
                      {selectedFeedback.email ? (
                        <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded">
                          <span className="text-secondary small text-truncate pe-2">{selectedFeedback.email}</span>
                          <button
                            className="btn btn-sm btn-link p-0 text-muted"
                            onClick={() => handleCopy(selectedFeedback.email, "email")}
                            title="Copy email to clipboard"
                          >
                            {copiedType === "email" ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted small italic">No email provided</span>
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-1">
                        Phone Number
                      </label>
                      {selectedFeedback.phone_number ? (
                        <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded">
                          <span className="text-secondary small">{selectedFeedback.phone_number}</span>
                          <button
                            className="btn btn-sm btn-link p-0 text-muted"
                            onClick={() => handleCopy(selectedFeedback.phone_number, "phone")}
                            title="Copy phone to clipboard"
                          >
                            {copiedType === "phone" ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted small italic">No phone number provided</span>
                      )}
                    </div>

                    <div>
                      <label className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-1">
                        Submitted On
                      </label>
                      <div className="d-flex align-items-center gap-2 text-secondary small">
                        <Calendar size={14} />
                        <span>{formatDate(selectedFeedback.created_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Feedback Message Content */}
                  <div className="col-md-7 d-flex flex-column">
                    <label className="text-muted text-uppercase tracking-wider small fw-semibold d-block mb-2">
                      User Message
                    </label>
                    <div
                      className="bg-light p-3 rounded text-secondary flex-grow-1 overflow-auto"
                      style={{ minHeight: 180, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: "1.6" }}
                    >
                      {selectedFeedback.description}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="modal-footer border-top-0 d-flex justify-content-between">
                <button
                  className="btn btn-outline-danger d-flex align-items-center gap-2"
                  onClick={() => handleDelete(selectedFeedback.id)}
                  id="btn-modal-delete-feedback"
                >
                  <Trash2 size={16} />
                  <span>Delete Feedback</span>
                </button>

                <div className="d-flex gap-2">
                  <button className="btn btn-secondary" onClick={() => setSelectedFeedback(null)}>
                    Close
                  </button>
                  {selectedFeedback.email && (
                    <a
                      className="btn btn-primary d-flex align-items-center gap-2"
                      href={`mailto:${selectedFeedback.email}?subject=Feedback regarding Cookeaze App`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Mail size={16} />
                      <span>Reply via Email</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Local custom style for CSS micro-animations */}
      <style>{`
        .spin-animation {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .tracking-wider {
          letter-spacing: 0.05em;
        }
      `}</style>
    </div>
  );
}
