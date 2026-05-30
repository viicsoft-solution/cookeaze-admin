// src/pages/FeedAdminPage.js
import React, { useEffect, useState } from "react";
import { axiosInstance } from "../api";

const isVideoUrl = (url = "") =>
  !!url && /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.trim());

const FeedAdminPage = () => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null);

  // Edit state
  const [editingFeed, setEditingFeed] = useState(null);
  const [editForm, setEditForm] = useState({ message: "", media_url: "" });
  const [editLoading, setEditLoading] = useState(false);

  // ✅ Pagination state
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const pageSize = 20; // adjust if your backend uses a different size

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  const fetchFeed = async (pageToLoad = 1) => {
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this feed?")) return;
    try {
      await axiosInstance.delete(`/feed/${id}/`);
      alert("Feed deleted successfully");

      // ✅ if last item on a page was deleted, step back a page safely
      const nextPage = feed.length === 1 && page > 1 ? page - 1 : page;

      fetchFeed(nextPage);
    } catch (err) {
      console.error(err);
      alert("Failed to delete feed");
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
        }
      };
      await axiosInstance.patch(`/feed/${editingFeed.id}/`, payload);
      alert("Feed updated successfully");
      
      setFeed(prevFeed => prevFeed.map(item => {
        if (item.id === editingFeed.id) {
          return {
            ...item,
            original_comment: {
              ...item.original_comment,
              message: editForm.message,
              media_url: editForm.media_url
            }
          };
        }
        return item;
      }));
      setEditingFeed(null);
    } catch (err) {
      console.error(err);
      alert("Failed to update feed");
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

  return (
    <div className="container mt-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="fw-bold mb-0">Feed Admin (Comments & Media)</h2>

        {/* ✅ Pagination controls (top) */}
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={goPrev}
            disabled={loading || page <= 1}
          >
            Prev
          </button>
          <span className="small text-muted">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>{" "}
            {count ? `• ${count} total` : ""}
          </span>
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={goNext}
            disabled={loading || page >= totalPages}
          >
            Next
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            style={{ width: 48, height: 48 }}
            role="status"
          />
        </div>
      ) : (
        <>
          <div className="table-responsive shadow-sm rounded">
            <table className="table align-middle mb-0">
              <thead className="table-light">
                <tr>
                  {/* ✅ removed ID column */}
                  <th>Original Comment</th>
                  <th>Media</th>
                  <th>Author</th>
                  <th style={{ width: 120 }}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {feed.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center text-muted py-4">
                      No feed found
                    </td>
                  </tr>
                ) : (
                  feed.map((item) => {
                    const original = item.original_comment;
                    const mediaUrl = original?.media_url || "";

                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {original?.message || "No comment message"}
                          </div>
                          <small className="text-muted">
                            {new Date(item.created_at).toLocaleString()}
                          </small>
                        </td>

                        {/* Media column */}
                        <td style={{ width: "280px" }}>
                          {mediaUrl ? (
                            isVideoUrl(mediaUrl) ? (
                              <div className="position-relative">
                                <video
                                  src={mediaUrl}
                                  muted
                                  style={{
                                    width: "100%",
                                    maxHeight: 160,
                                    objectFit: "cover",
                                    borderRadius: 8,
                                  }}
                                  playsInline
                                />
                                <button
                                  className="btn btn-sm btn-dark position-absolute top-50 start-50 translate-middle"
                                  onClick={() => setSelectedVideo(mediaUrl)}
                                  aria-label="Play video"
                                >
                                  ▶ Play
                                </button>
                              </div>
                            ) : (
                              <img
                                src={mediaUrl}
                                alt="Comment media"
                                style={{
                                  width: "100%",
                                  maxHeight: 160,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                }}
                              />
                            )
                          ) : (
                            <div className="text-muted small">No media</div>
                          )}
                        </td>

                        {/* Author column */}
                        <td>
                          <div className="d-flex align-items-center">
                            <img
                              src={
                                item.user?.profile_picture_url ||
                                "https://via.placeholder.com/80"
                              }
                              alt={item.user?.first_name || "User"}
                              className="rounded-circle me-2"
                              width="36"
                              height="36"
                              style={{ objectFit: "cover" }}
                            />
                            <div style={{ lineHeight: 1 }}>
                              <div
                                className="fw-semibold"
                                style={{ fontSize: 14 }}
                              >
                                {item.user?.first_name || ""}{" "}
                                {item.user?.last_name || ""}
                              </div>
                              <small className="text-muted">
                                {new Date(item.created_at).toLocaleString()}
                              </small>
                            </div>
                          </div>
                        </td>

                        {/* Actions */}
                        <td>
                          <button
                            onClick={() => openEditModal(item)}
                            className="btn btn-sm btn-primary me-2 mb-1"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="btn btn-sm btn-danger mb-1"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* ✅ Pagination controls (bottom) */}
          {totalPages > 1 && (
            <div className="d-flex justify-content-center align-items-center gap-2 mt-3">
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={goPrev}
                disabled={loading || page <= 1}
              >
                Prev
              </button>
              <span className="small text-muted">
                Page <strong>{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={goNext}
                disabled={loading || page >= totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {/* Video modal */}
      {selectedVideo && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 9999 }}
          onClick={() => setSelectedVideo(null)}
        >
          <div
            className="bg-white p-3 rounded shadow"
            style={{ maxWidth: 900, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              src={selectedVideo}
              controls
              autoPlay
              style={{ width: "100%", borderRadius: 8 }}
            />
            <div className="text-end mt-2">
              <button
                className="btn btn-outline-danger btn-sm"
                onClick={() => setSelectedVideo(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editingFeed && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(0,0,0,0.6)", zIndex: 9999 }}
          onClick={() => setEditingFeed(null)}
        >
          <div
            className="bg-white p-4 rounded shadow"
            style={{ maxWidth: 600, width: "95%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h4 className="mb-3">Edit Feed Content</h4>
            <form onSubmit={handleEditSubmit}>
              <div className="mb-3">
                <label className="form-label fw-bold">Message</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={editForm.message}
                  onChange={(e) => setEditForm({ ...editForm, message: e.target.value })}
                  required
                ></textarea>
              </div>
              <div className="mb-3">
                <label className="form-label fw-bold">Media URL (Video or Image)</label>
                <input
                  type="url"
                  className="form-control"
                  value={editForm.media_url}
                  onChange={(e) => setEditForm({ ...editForm, media_url: e.target.value })}
                />
              </div>
              <div className="d-flex justify-content-end gap-2 mt-4">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setEditingFeed(null)}
                  disabled={editLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editLoading}
                >
                  {editLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedAdminPage;
