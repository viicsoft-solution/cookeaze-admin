// src/pages/FeedAdminPage.js
import React, { useEffect, useState } from "react";
import { axiosInstance } from "../api";

const isVideoUrl = (url = "") =>
  !!url && /\.(mp4|webm|ogg)(\?.*)?$/i.test(url.trim());

const FeedAdminPage = () => {
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState(null); // for modal video

  const fetchFeed = async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/feed/");
      const results = res.data?.data?.results || [];
      setFeed(results);
    } catch (err) {
      console.error("Failed to fetch feed:", err);
      setFeed([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this feed?")) return;
    try {
      await axiosInstance.delete(`/feed/${id}/`);
      alert("Feed deleted successfully");
      fetchFeed();
    } catch (err) {
      console.error(err);
      alert("Failed to delete feed");
    }
  };

  return (
    <div className="container mt-4">
      <h2 className="fw-bold mb-4">Feed Admin (Comments & Media)</h2>

      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            style={{ width: 48, height: 48 }}
            role="status"
          />
        </div>
      ) : (
        <div className="table-responsive shadow-sm rounded">
          <table className="table align-middle">
            <thead className="table-light">
              <tr>
                <th style={{ width: 60 }}>ID</th>
                <th>Original Comment</th>
                <th>Media</th>
                <th>Author</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {feed.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center text-muted py-4">
                    No feed found
                  </td>
                </tr>
              ) : (
                feed.map((item) => {
                  const original = item.original_comment;
                  const mediaUrl = original?.media_url || "";

                  return (
                    <tr key={item.id}>
                      <td>{item.id}</td>

                      <td>
                        <div style={{ whiteSpace: "pre-wrap" }}>
                          {original?.message || "No comment message"}
                        </div>
                        <small className="text-muted">
                          {new Date(item.created_at).toLocaleString()}
                        </small>
                      </td>

                      {/* media column */}
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
                                // keep controls hidden in table; modal will play
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

                      {/* Author column (replaced comments column) */}
                      <td>
                        <div className="d-flex justify-content-between align-items-center">
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
                        </div>
                      </td>

                      {/* delete button */}
                      <td>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="btn btn-sm btn-danger"
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
    </div>
  );
};

export default FeedAdminPage;
