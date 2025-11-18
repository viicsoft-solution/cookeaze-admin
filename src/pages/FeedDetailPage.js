import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { axiosInstance } from "../api";

const FeedDetailPage = () => {
  const { id } = useParams();
  const [feedItem, setFeedItem] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // fetch feed list (same approach as before) and locate the item
    axiosInstance
      .get("/feed/")
      .then((res) => {
        const results = res.data.data?.results || [];
        const found = results.find((i) => Number(i.id) === Number(id));
        setFeedItem(found || null);
      })
      .catch((err) => {
        console.error("Failed to fetch feed:", err);
        setFeedItem(null);
      });

    // fetch comments for this feed item
    axiosInstance
      .get(`/feed/${id}/comments/`)
      .then((res) => setComments(res.data.data?.results || []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!feedItem)
    return (
      <div className="container mt-5 text-center">
        <h4 className="text-muted">Feed item not found</h4>
        <Link to="/feed" className="btn btn-link mt-3">
          Back to feed
        </Link>
      </div>
    );

  const { recipe, user, original_comment } = feedItem;
  const leftImageStyle = {
    width: "420px",
    height: "320px",
    objectFit: "cover",
    borderRadius: 8,
  };

  return (
    <div className="container mt-4">
      <div className="mb-3">
        <Link to="/feed" className="btn btn-link">
          ← Back to Feed
        </Link>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          {/* top area: image left, summary right */}
          <div className="row g-4">
            <div className="col-md-5">
              <img
                src={
                  recipe.image_url ||
                  "https://via.placeholder.com/640x480?text=No+Image"
                }
                alt={recipe.name}
                style={leftImageStyle}
              />
            </div>

            <div className="col-md-7">
              <h2 className="mb-2">{recipe.name}</h2>
              <div className="mb-2">
                {recipe.category?.map((c, i) => (
                  <span className="badge bg-secondary me-1" key={i}>
                    {c}
                  </span>
                ))}
              </div>

              <p className="text-muted mb-3">{recipe.description}</p>

              <div className="d-flex align-items-center mb-3">
                <img
                  src={
                    user.profile_picture_url || "https://via.placeholder.com/80"
                  }
                  alt={user.first_name}
                  className="rounded-circle me-2"
                  width="48"
                  height="48"
                  style={{ objectFit: "cover" }}
                />
                <div>
                  <div className="fw-semibold">
                    {user.first_name} {user.last_name}
                  </div>
                  <small className="text-muted">
                    Posted {new Date(feedItem.created_at).toLocaleString()}
                  </small>
                </div>
              </div>

              <div className="d-flex gap-2">
                <div className="me-3">
                  <strong>⏱</strong> {recipe.total_time}m
                </div>
                <div className="me-3">
                  <strong>🍽</strong> {recipe.servings} servings
                </div>
                <div>
                  <strong>⭐</strong> {recipe.rating ?? "—"}
                </div>
              </div>
            </div>
          </div>

          <hr className="my-4" />

          <div className="row">
            <div className="col-md-6">
              <h5>Ingredients</h5>
              <ul className="list-group list-group-flush mb-3">
                {recipe.ingredients?.map((ing) => (
                  <li className="list-group-item" key={ing.id}>
                    <div className="d-flex justify-content-between">
                      <div>{ing.name}</div>
                      <div className="text-muted">
                        {ing.quantity} {ing.unit}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col-md-6">
              <h5>Steps</h5>
              <ol className="ps-3">
                {recipe.steps?.map((st) => (
                  <li key={st.id} className="mb-2">
                    <div>{st.description}</div>
                    <div className="small text-muted">
                      ({st.step_type} • {st.duration}m)
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Original comment */}
          {original_comment && (
            <>
              <hr />
              <h5 className="mt-3">Original Comment</h5>
              <div className="border rounded p-3 bg-light">
                <p className="mb-2">{original_comment.message}</p>
                {original_comment.media_url ? (
                  <img
                    src={original_comment.media_url}
                    alt="Shared media"
                    className="img-fluid rounded"
                    style={{ maxHeight: 260, objectFit: "cover" }}
                  />
                ) : (
                  <div className="text-muted small">No media attached</div>
                )}
              </div>
            </>
          )}

          <hr className="my-4" />

          <h5>Comments ({comments.length})</h5>
          <div className="mb-3">
            {comments.length ? (
              comments.map((c) => (
                <div className="border-bottom py-2" key={c.id}>
                  <div className="fw-semibold small">
                    {c.user?.first_name ?? "Anonymous"}
                    <span className="text-muted ms-2 small">
                      {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>{c.message}</div>
                </div>
              ))
            ) : (
              <div className="text-muted small">No comments yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeedDetailPage;
