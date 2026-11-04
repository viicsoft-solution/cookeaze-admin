// src/pages/FeedAdminPage.js
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Search,
  RefreshCw,
  MessageSquare,
  Video,
  Image as ImageIcon,
  FileText,
  Play,
  Edit3,
  Trash2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  X,
  CheckCircle2,
  AlertCircle,
  BookOpen,
} from "lucide-react";
import { axiosInstance } from "../api";
import "./Feed.css";

const isVideoUrl = (url = "") =>
  Boolean(url && /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(url).trim()));

function getInitials(user) {
  const first = String(user?.first_name || "").trim();
  const last = String(user?.last_name || "").trim();
  const combined = `${first} ${last}`.trim();
  if (!combined) return "CK";
  const parts = combined.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const FeedAdminPage = () => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [brokenAvatars, setBrokenAvatars] = useState({});

  // Search, Media Filter & Layout
  const [searchQuery, setSearchQuery] = useState("");
  const [mediaFilter, setMediaFilter] = useState("all"); // all | video | image | text
  const [viewMode, setViewMode] = useState("table"); // table | cards

  // Toast feedback
  const [toast, setToast] = useState(null);

  // Media Lightbox state
  const [previewMedia, setPreviewMedia] = useState(null);

  // Edit modal state
  const [editingFeed, setEditingFeed] = useState(null);
  const [editForm, setEditForm] = useState({ message: "", media_url: "" });
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation modal state
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const pageSize = 20;

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchFeed = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(`/feed/?page=${pageToLoad}`);
        const results = res.data?.data?.results || [];
        const totalCount = res.data?.data?.count || results.length;

        setFeed(results);
        setCount(totalCount);
        setPage(pageToLoad);
      } catch (err) {
        console.error("Failed to fetch feed:", err);
        setFeed([]);
        setCount(0);
        showToast("error", "Failed to load community feed posts.");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchFeed(1);
  }, [fetchFeed]);

  // Stats & filtered list
  const stats = useMemo(() => {
    let videos = 0;
    let images = 0;
    feed.forEach((item) => {
      const url = item.original_comment?.media_url || "";
      if (url) {
        if (isVideoUrl(url)) videos += 1;
        else images += 1;
      }
    });
    return {
      total: count || feed.length,
      videos,
      images,
      onPage: feed.length,
    };
  }, [feed, count]);

  const filteredFeed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return feed.filter((item) => {
      const msg = String(item.original_comment?.message || "").toLowerCase();
      const author = `${item.user?.first_name || ""} ${
        item.user?.last_name || ""
      }`.toLowerCase();
      const recipeName = String(item.recipe?.name || "").toLowerCase();
      const mediaUrl = item.original_comment?.media_url || "";

      if (q && !msg.includes(q) && !author.includes(q) && !recipeName.includes(q)) {
        return false;
      }

      if (mediaFilter === "video") return isVideoUrl(mediaUrl);
      if (mediaFilter === "image") return Boolean(mediaUrl) && !isVideoUrl(mediaUrl);
      if (mediaFilter === "text") return !mediaUrl;
      return true;
    });
  }, [feed, searchQuery, mediaFilter]);

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    setDeleteLoading(true);
    try {
      await axiosInstance.delete(`/feed/${deletingItem.id}/`);
      showToast("success", "Feed post deleted.");
      setDeletingItem(null);
      const nextPage = feed.length === 1 && page > 1 ? page - 1 : page;
      fetchFeed(nextPage);
    } catch (err) {
      console.error(err);
      showToast(
        "error",
        err.response?.data?.message || "Failed to delete feed post."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditModal = (item) => {
    setEditingFeed(item);
    setEditForm({
      message: item.original_comment?.message || "",
      media_url: item.original_comment?.media_url || "",
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingFeed) return;
    setEditLoading(true);
    try {
      const payload = {
        original_comment: {
          message: editForm.message,
          media_url: editForm.media_url,
        },
      };
      await axiosInstance.patch(`/feed/${editingFeed.id}/`, payload);

      setFeed((prevFeed) =>
        prevFeed.map((item) => {
          if (item.id === editingFeed.id) {
            return {
              ...item,
              original_comment: {
                ...item.original_comment,
                message: editForm.message,
                media_url: editForm.media_url,
              },
            };
          }
          return item;
        })
      );
      setEditingFeed(null);
      showToast("success", "Feed comment & media updated.");
    } catch (err) {
      console.error(err);
      showToast(
        "error",
        err.response?.data?.message || "Failed to update feed post."
      );
    } finally {
      setEditLoading(false);
    }
  };

  const goPrev = () => {
    if (page <= 1) return;
    fetchFeed(page - 1);
  };

  const goNext = () => {
    if (page >= totalPages) return;
    fetchFeed(page + 1);
  };

  const renderAuthorAvatar = (item) => {
    const key = item.id || item.user?.id;
    const url = item.user?.profile_picture_url;
    const showImg = url && !url.includes("via.placeholder.com") && !brokenAvatars[key];

    if (showImg) {
      return (
        <img
          src={url}
          alt={item.user?.first_name || "Author"}
          className="fd-avatar"
          onError={() =>
            setBrokenAvatars((prev) => ({ ...prev, [key]: true }))
          }
        />
      );
    }
    return <div className="fd-avatar">{getInitials(item.user)}</div>;
  };

  return (
    <div className="fd-page">
      {/* Page Header */}
      <div className="fd-header">
        <div className="fd-header-left">
          <h1 className="fd-title">Feed Moderation (Comments & Media)</h1>
          <p className="fd-subtitle">
            Review community recipe comments, inspect uploaded videos & photos, and moderate posts.
          </p>
        </div>

        <div className="fd-header-actions">
          <button
            type="button"
            className="fd-btn fd-btn-secondary"
            onClick={() => fetchFeed(page)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? "spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="fd-stats-grid">
        <div className="fd-stat-card">
          <div>
            <div className="fd-stat-label">Total Feed Posts</div>
            {loading ? (
              <div
                className="fd-shimmer"
                style={{ width: 64, height: 24, marginTop: 2 }}
              />
            ) : (
              <div className="fd-stat-value">{stats.total}</div>
            )}
          </div>
          <div className="fd-stat-icon">
            <MessageSquare size={18} />
          </div>
        </div>

        <div className="fd-stat-card">
          <div>
            <div className="fd-stat-label">Videos (Current Page)</div>
            {loading ? (
              <div
                className="fd-shimmer"
                style={{ width: 52, height: 24, marginTop: 2 }}
              />
            ) : (
              <div className="fd-stat-value">{stats.videos}</div>
            )}
          </div>
          <div className="fd-stat-icon">
            <Video size={18} />
          </div>
        </div>

        <div className="fd-stat-card">
          <div>
            <div className="fd-stat-label">Photos (Current Page)</div>
            {loading ? (
              <div
                className="fd-shimmer"
                style={{ width: 52, height: 24, marginTop: 2 }}
              />
            ) : (
              <div className="fd-stat-value">{stats.images}</div>
            )}
          </div>
          <div className="fd-stat-icon">
            <ImageIcon size={18} />
          </div>
        </div>

        <div className="fd-stat-card">
          <div>
            <div className="fd-stat-label">Page Status</div>
            {loading ? (
              <div
                className="fd-shimmer"
                style={{ width: 72, height: 24, marginTop: 2 }}
              />
            ) : (
              <div className="fd-stat-value">
                {page}{" "}
                <span
                  style={{
                    fontSize: "0.88rem",
                    color: "#64748b",
                    fontWeight: 500,
                  }}
                >
                  / {totalPages}
                </span>
              </div>
            )}
          </div>
          <div className="fd-stat-icon">
            <FileText size={18} />
          </div>
        </div>
      </div>

      {/* Toast Banner */}
      {toast && (
        <div className={`fd-toast ${toast.type}`}>
          <div className="fd-toast-left">
            {toast.type === "error" ? (
              <AlertCircle size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="fd-toast-close"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search, Media Filter & View Toolbar */}
      <div className="fd-toolbar">
        <div className="fd-toolbar-left">
          <div className="fd-search-box">
            <Search size={14} className="fd-search-icon" />
            <input
              type="text"
              className="fd-search-input"
              placeholder="Search comments, authors, or recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                className="fd-search-clear"
                onClick={() => setSearchQuery("")}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="fd-segmented">
            <button
              type="button"
              className={`fd-seg-btn ${mediaFilter === "all" ? "active" : ""}`}
              onClick={() => setMediaFilter("all")}
            >
              All ({feed.length})
            </button>
            <button
              type="button"
              className={`fd-seg-btn ${mediaFilter === "video" ? "active" : ""}`}
              onClick={() => setMediaFilter("video")}
            >
              <Video size={13} />
              Videos ({stats.videos})
            </button>
            <button
              type="button"
              className={`fd-seg-btn ${mediaFilter === "image" ? "active" : ""}`}
              onClick={() => setMediaFilter("image")}
            >
              <ImageIcon size={13} />
              Photos ({stats.images})
            </button>
            <button
              type="button"
              className={`fd-seg-btn ${mediaFilter === "text" ? "active" : ""}`}
              onClick={() => setMediaFilter("text")}
            >
              Text Only
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="fd-segmented">
            <button
              type="button"
              className={`fd-seg-btn ${viewMode === "table" ? "active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              <List size={13} />
              Table
            </button>
            <button
              type="button"
              className={`fd-seg-btn ${viewMode === "cards" ? "active" : ""}`}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid size={13} />
              Cards
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        viewMode === "table" ? (
          <div className="fd-table-card">
            <div className="fd-table-wrap">
              <table className="fd-table">
                <thead>
                  <tr>
                    <th style={{ width: 220 }}>Author & Date</th>
                    <th>Comment & Recipe</th>
                    <th style={{ width: 165 }}>Attached Media</th>
                    <th style={{ width: 160, textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <tr key={idx}>
                      <td>
                        <div className="fd-author">
                          <div
                            className="fd-shimmer"
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: "50%",
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                            }}
                          >
                            <div
                              className="fd-shimmer"
                              style={{ width: 110, height: 14 }}
                            />
                            <div
                              className="fd-shimmer"
                              style={{ width: 90, height: 11 }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="fd-comment-box">
                          <div
                            className="fd-shimmer"
                            style={{ width: "92%", height: 14 }}
                          />
                          <div
                            className="fd-shimmer"
                            style={{ width: "74%", height: 14 }}
                          />
                          <div
                            className="fd-shimmer"
                            style={{ width: 130, height: 20, borderRadius: 6 }}
                          />
                        </div>
                      </td>
                      <td>
                        <div
                          className="fd-shimmer"
                          style={{
                            width: 136,
                            height: 86,
                            borderRadius: 10,
                          }}
                        />
                      </td>
                      <td>
                        <div className="fd-actions">
                          <div
                            className="fd-shimmer"
                            style={{ width: 62, height: 31 }}
                          />
                          <div
                            className="fd-shimmer"
                            style={{ width: 68, height: 31 }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="fd-cards-grid">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="fd-card">
                <div
                  className="fd-card-media fd-shimmer"
                  style={{ borderRadius: 0 }}
                />
                <div className="fd-card-body">
                  <div className="fd-author">
                    <div
                      className="fd-shimmer"
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                      }}
                    >
                      <div
                        className="fd-shimmer"
                        style={{ width: 110, height: 14 }}
                      />
                      <div
                        className="fd-shimmer"
                        style={{ width: 85, height: 11 }}
                      />
                    </div>
                  </div>
                  <div
                    className="fd-shimmer"
                    style={{ width: "92%", height: 13 }}
                  />
                  <div
                    className="fd-shimmer"
                    style={{ width: "68%", height: 13 }}
                  />
                </div>
                <div className="fd-card-footer">
                  <div
                    className="fd-shimmer"
                    style={{ flex: 1, height: 31 }}
                  />
                  <div
                    className="fd-shimmer"
                    style={{ width: 68, height: 31 }}
                  />
                </div>
              </div>
            ))}
          </div>
        )
      ) : filteredFeed.length === 0 ? (
        <div className="fd-empty">
          <MessageSquare size={26} style={{ color: "#94a3b8" }} />
          <h4>No matching feed posts</h4>
          <p>
            {searchQuery || mediaFilter !== "all"
              ? "Try clearing your search or switching the media filter."
              : "No community feed posts found on this page."}
          </p>
        </div>
      ) : viewMode === "table" ? (
        <div className="fd-table-card">
          <div className="fd-table-wrap">
            <table className="fd-table">
              <thead>
                <tr>
                  <th style={{ width: 220 }}>Author & Date</th>
                  <th>Comment & Recipe</th>
                  <th style={{ width: 165 }}>Attached Media</th>
                  <th style={{ width: 160, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeed.map((item) => {
                  const original = item.original_comment;
                  const mediaUrl = original?.media_url || "";
                  const isVid = isVideoUrl(mediaUrl);
                  const authorName =
                    `${item.user?.first_name || ""} ${
                      item.user?.last_name || ""
                    }`.trim() || "Cookeaze User";

                  return (
                    <tr key={item.id}>
                      {/* Author & Single Timestamp */}
                      <td>
                        <div className="fd-author">
                          {renderAuthorAvatar(item)}
                          <div>
                            <div className="fd-author-name">{authorName}</div>
                            <div className="fd-author-date">
                              {formatDateTime(item.created_at)}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Comment & Linked Recipe */}
                      <td>
                        <div className="fd-comment-box">
                          <p className="fd-comment-text">
                            {original?.message || "No comment text provided."}
                          </p>
                          {item.recipe?.name && (
                            <Link
                              to={`/feed/${item.id}`}
                              className="fd-recipe-tag"
                            >
                              <BookOpen size={11} />
                              {item.recipe.name}
                            </Link>
                          )}
                        </div>
                      </td>

                      {/* Compact Media Preview */}
                      <td>
                        {mediaUrl ? (
                          <div
                            className="fd-media-thumb"
                            onClick={() =>
                              setPreviewMedia({
                                url: mediaUrl,
                                isVideo: isVid,
                                author: authorName,
                                message: original?.message || "",
                              })
                            }
                            title="Click to inspect media"
                          >
                            {isVid ? (
                              <>
                                <video src={mediaUrl} muted playsInline />
                                <div className="fd-media-overlay">
                                  <span className="fd-play-pill">
                                    <Play size={11} fill="#ffffff" />
                                    Play
                                  </span>
                                </div>
                              </>
                            ) : (
                              <>
                                <img src={mediaUrl} alt="Feed attachment" />
                                <div className="fd-media-overlay">
                                  <span className="fd-play-pill">
                                    <ImageIcon size={11} />
                                    View
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        ) : (
                          <span className="fd-no-media">Text only</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: "right" }}>
                        <div className="fd-actions">
                          <button
                            type="button"
                            className="fd-btn fd-btn-secondary fd-btn-sm"
                            onClick={() => openEditModal(item)}
                          >
                            <Edit3 size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            className="fd-btn fd-btn-danger-ghost fd-btn-sm"
                            onClick={() => setDeletingItem(item)}
                          >
                            <Trash2 size={13} />
                            Delete
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
      ) : (
        /* Compact Cards View */
        <div className="fd-cards-grid">
          {filteredFeed.map((item) => {
            const original = item.original_comment;
            const mediaUrl = original?.media_url || "";
            const isVid = isVideoUrl(mediaUrl);
            const authorName =
              `${item.user?.first_name || ""} ${
                item.user?.last_name || ""
              }`.trim() || "Cookeaze User";

            return (
              <div key={item.id} className="fd-card">
                {mediaUrl && (
                  <div
                    className="fd-card-media"
                    onClick={() =>
                      setPreviewMedia({
                        url: mediaUrl,
                        isVideo: isVid,
                        author: authorName,
                        message: original?.message || "",
                      })
                    }
                  >
                    {isVid ? (
                      <>
                        <video src={mediaUrl} muted playsInline />
                        <div className="fd-media-overlay">
                          <span className="fd-play-pill">
                            <Play size={12} fill="#ffffff" />
                            Play Video
                          </span>
                        </div>
                      </>
                    ) : (
                      <img src={mediaUrl} alt="Comment media" />
                    )}
                  </div>
                )}

                <div className="fd-card-body">
                  <div className="fd-author" style={{ minWidth: 0 }}>
                    {renderAuthorAvatar(item)}
                    <div style={{ minWidth: 0 }}>
                      <div className="fd-author-name">{authorName}</div>
                      <div className="fd-author-date">
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                  </div>

                  <p className="fd-card-comment">
                    {original?.message || "No comment message"}
                  </p>

                  {item.recipe?.name && (
                    <Link to={`/feed/${item.id}`} className="fd-recipe-tag">
                      <BookOpen size={11} />
                      {item.recipe.name}
                    </Link>
                  )}
                </div>

                <div className="fd-card-footer">
                  <button
                    type="button"
                    className="fd-btn fd-btn-secondary fd-btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => openEditModal(item)}
                  >
                    <Edit3 size={12} />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="fd-btn fd-btn-danger-ghost fd-btn-sm"
                    onClick={() => setDeletingItem(item)}
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      <div className="fd-pagination">
        <span className="fd-page-info">
          Showing page <strong>{page}</strong> of <strong>{totalPages}</strong>
          {count ? ` (${count} total feed posts)` : ""}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            className="fd-btn fd-btn-secondary fd-btn-sm"
            onClick={goPrev}
            disabled={loading || page <= 1}
          >
            <ChevronLeft size={14} />
            Previous
          </button>
          <button
            type="button"
            className="fd-btn fd-btn-secondary fd-btn-sm"
            onClick={goNext}
            disabled={loading || page >= totalPages}
          >
            Next
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Media Lightbox Modal (Video & Image) */}
      {previewMedia && (
        <div
          className="fd-modal-backdrop"
          onClick={() => setPreviewMedia(null)}
        >
          <div
            className="fd-modal-card wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fd-modal-header">
              <h3>Media Preview — {previewMedia.author}</h3>
              <button
                type="button"
                className="fd-modal-close"
                onClick={() => setPreviewMedia(null)}
              >
                <X size={15} />
              </button>
            </div>
            <div className="fd-modal-body">
              <div
                style={{
                  background: "#0f172a",
                  borderRadius: 10,
                  overflow: "hidden",
                  maxHeight: 460,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {previewMedia.isVideo ? (
                  <video
                    src={previewMedia.url}
                    controls
                    autoPlay
                    style={{ width: "100%", maxHeight: 460, display: "block" }}
                  />
                ) : (
                  <img
                    src={previewMedia.url}
                    alt="Feed attachment"
                    style={{
                      maxWidth: "100%",
                      maxHeight: 460,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                )}
              </div>
              {previewMedia.message && (
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.86rem",
                    color: "#334155",
                    lineHeight: 1.5,
                  }}
                >
                  {previewMedia.message}
                </p>
              )}
            </div>
            <div className="fd-modal-footer">
              <button
                type="button"
                className="fd-btn fd-btn-secondary"
                onClick={() => setPreviewMedia(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Feed Modal */}
      {editingFeed && (
        <div
          className="fd-modal-backdrop"
          onClick={() => !editLoading && setEditingFeed(null)}
        >
          <div
            className="fd-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fd-modal-header">
              <h3>Edit Feed Comment & Media</h3>
              <button
                type="button"
                className="fd-modal-close"
                onClick={() => setEditingFeed(null)}
                disabled={editLoading}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="fd-modal-body">
                <div>
                  <label className="fd-label">Comment Message</label>
                  <textarea
                    className="fd-textarea"
                    placeholder="Write comment text..."
                    value={editForm.message}
                    onChange={(e) =>
                      setEditForm({ ...editForm, message: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <label className="fd-label">
                    Media URL (Video or Photo)
                  </label>
                  <input
                    type="url"
                    className="fd-input"
                    placeholder="https://res.cloudinary.com/..."
                    value={editForm.media_url}
                    onChange={(e) =>
                      setEditForm({ ...editForm, media_url: e.target.value })
                    }
                  />
                </div>

                {editForm.media_url && (
                  <div
                    style={{
                      borderRadius: 10,
                      overflow: "hidden",
                      border: "1px solid #e2e8f0",
                      background: "#0f172a",
                      maxHeight: 180,
                    }}
                  >
                    {isVideoUrl(editForm.media_url) ? (
                      <video
                        src={editForm.media_url}
                        controls
                        muted
                        style={{
                          width: "100%",
                          maxHeight: 180,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      <img
                        src={editForm.media_url}
                        alt="Media preview"
                        style={{
                          width: "100%",
                          maxHeight: 180,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>

              <div className="fd-modal-footer">
                <button
                  type="button"
                  className="fd-btn fd-btn-secondary"
                  onClick={() => setEditingFeed(null)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fd-btn fd-btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div
          className="fd-modal-backdrop"
          onClick={() => !deleteLoading && setDeletingItem(null)}
        >
          <div
            className="fd-modal-card"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="fd-modal-header">
              <h3>Delete Feed Post</h3>
              <button
                type="button"
                className="fd-modal-close"
                onClick={() => setDeletingItem(null)}
                disabled={deleteLoading}
              >
                <X size={15} />
              </button>
            </div>
            <div className="fd-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", color: "#334155", lineHeight: 1.5 }}>
                Are you sure you want to permanently delete this comment from{" "}
                <strong>
                  {`${deletingItem.user?.first_name || ""} ${
                    deletingItem.user?.last_name || ""
                  }`.trim() || "this user"}
                </strong>
                ? This action cannot be undone.
              </p>
            </div>
            <div className="fd-modal-footer">
              <button
                type="button"
                className="fd-btn fd-btn-secondary"
                onClick={() => setDeletingItem(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="fd-btn fd-btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Deleting..." : "Delete Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedAdminPage;
