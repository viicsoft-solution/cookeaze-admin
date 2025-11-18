// src/pages/CategoryDetail.js
import React, { useEffect, useState } from "react";
import { getAxiosInstance } from "../api";
import { useNavigate, useParams, Link } from "react-router-dom";

export default function CategoryDetail() {
  const axios = getAxiosInstance();
  const { id } = useParams();
  const [cat, setCat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  const fetch = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await axios.get(`/categories/${id}/`);
      setCat(res.data?.data ?? null);
    } catch (err) {
      console.error(err);
      setStatus({ type: "danger", text: "Failed to load category." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    // eslint-disable-next-line
  }, [id]);

  const onDelete = async () => {
    if (!window.confirm("Delete this category?")) return;
    try {
      await axios.delete(`/categories/${id}/`);
      navigate("/categories");
    } catch (err) {
      console.error(err);
      setStatus({ type: "danger", text: "Delete failed." });
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Category Detail</h3>
        <div className="d-flex gap-2">
          <Link
            className="btn btn-outline-secondary btn-sm"
            to={`/categories/${id}/edit`}
          >
            Edit
          </Link>
          <button className="btn btn-outline-danger btn-sm" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      {status && (
        <div className={`alert alert-${status.type}`}>{status.text}</div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : !cat ? (
        <div className="alert alert-warning">Category not found.</div>
      ) : (
        <div className="card p-4 shadow-sm">
          <div className="row">
            <div className="col-md-4">
              <div
                style={{
                  minHeight: 200,
                  background: "#f8f9fa",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {cat.image_url ? (
                  <img
                    src={cat.image_url}
                    alt={cat.category_name}
                    className="img-fluid"
                    style={{
                      maxHeight: 240,
                      width: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div className="text-muted">No image</div>
                )}
              </div>
            </div>
            <div className="col-md-8">
              <h4>{cat.category_name}</h4>
              <p className="text-muted">ID: {cat.id}</p>
              <div className="mt-3">
                <button
                  className="btn btn-secondary me-2"
                  onClick={() => navigate(-1)}
                >
                  Back
                </button>
                <Link
                  className="btn btn-primary"
                  to={`/categories/${cat.id}/edit`}
                >
                  Edit
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
