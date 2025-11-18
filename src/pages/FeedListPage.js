import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { axiosInstance } from "../api";

const FeedListPage = () => {
  const [feed, setFeed] = useState([]);

  useEffect(() => {
    axiosInstance
      .get("/feed/")
      .then((res) => setFeed(res.data.data.results || []))
      .catch((err) => console.error("Failed to fetch feed:", err));
  }, []);

  const imageStyle = {
    width: "160px",
    height: "120px",
    objectFit: "cover",
    borderRadius: 8,
    flexShrink: 0,
  };

  return (
    <div className="container mt-4">
      <h2 className="mb-4 fw-bold">Community Feed</h2>

      <div className="row">
        {feed.map((item) => (
          <div className="col-md-6 mb-4" key={item.id}>
            <div className="card shadow-sm h-100">
              <div className="card-body d-flex gap-3 align-items-start">
                {/* Left: fixed-size image */}
                <div>
                  <img
                    src={
                      item.recipe.image_url ||
                      "https://via.placeholder.com/320x240?text=No+Image"
                    }
                    alt={item.recipe.name}
                    style={imageStyle}
                  />
                </div>

                {/* Right: text */}
                <div className="flex-grow-1">
                  <h5 className="card-title mb-1">{item.recipe.name}</h5>
                  <div className="mb-2">
                    {item.recipe.category?.slice(0, 2).map((c, i) => (
                      <span className="badge bg-secondary me-1" key={i}>
                        {c}
                      </span>
                    ))}
                  </div>
                  <p
                    className="card-text text-muted"
                    style={{ marginBottom: 10 }}
                  >
                    {item.recipe.description
                      ? item.recipe.description.slice(0, 140) +
                        (item.recipe.description.length > 140 ? "…" : "")
                      : "No description"}
                  </p>

                  <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center">
                      <img
                        src={
                          item.user.profile_picture_url ||
                          "https://via.placeholder.com/80"
                        }
                        alt={item.user.first_name}
                        className="rounded-circle me-2"
                        width="36"
                        height="36"
                        style={{ objectFit: "cover" }}
                      />
                      <div style={{ lineHeight: 1 }}>
                        <div className="fw-semibold" style={{ fontSize: 14 }}>
                          {item.user.first_name} {item.user.last_name}
                        </div>
                        <small className="text-muted">
                          {new Date(item.created_at).toLocaleString()}
                        </small>
                      </div>
                    </div>

                    <div>
                      <Link
                        to={`/feed/${item.id}`}
                        className="btn btn-outline-primary btn-sm"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>{" "}
              {/* end card-body */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeedListPage;
