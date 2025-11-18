// src/pages/CategoriesList.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getAxiosInstance } from "../api";

export default function CategoriesList() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const axios = getAxiosInstance();
  const navigate = useNavigate();

  const fetchCategories = async (q = "") => {
    setLoading(true);
    setStatus(null);
    try {
      const url = q
        ? `/categories/?search=${encodeURIComponent(q)}`
        : "/categories/";
      const res = await axios.get(url);
      const data = res.data?.data ?? [];
      setCategories(data);
    } catch (err) {
      console.error(err);
      setStatus({ type: "danger", text: "Failed to load categories" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
    // eslint-disable-next-line
  }, []);

  const onDelete = async (id) => {
    if (!window.confirm("Delete this category?")) return;
    setStatus(null);
    try {
      await axios.delete(`/categories/${id}/`);
      setCategories((prev) => prev.filter((c) => c.id !== id));
      setStatus({ type: "success", text: "Category deleted." });
    } catch (err) {
      console.error(err);
      setStatus({ type: "danger", text: "Failed to delete." });
    }
  };

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h3 className="mb-0">Categories</h3>
        <div className="d-flex gap-2">
          <input
            className="form-control form-control-sm"
            style={{ minWidth: 220 }}
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchCategories(search)}
          />
          <button
            className="btn btn-outline-secondary btn-sm"
            onClick={() => fetchCategories(search)}
          >
            Search
          </button>
          <Link to="/categories/create" className="btn btn-primary btn-sm">
            + Create
          </Link>
        </div>
      </div>

      {status && (
        <div className={`alert alert-${status.type}`}>{status.text}</div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"></div>
        </div>
      ) : (
        <>
          {categories.length === 0 ? (
            <div className="text-muted">No categories found.</div>
          ) : (
            <div className="row g-3">
              {categories.map((c) => (
                <div className="col-md-4" key={c.id}>
                  <div className="card h-100 shadow-sm">
                    <div
                      style={{
                        height: 140,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#f8f9fa",
                      }}
                    >
                      {c.image_url ? (
                        <img
                          src={c.image_url}
                          alt={c.category_name}
                          style={{
                            height: "100%",
                            objectFit: "cover",
                            width: "100%",
                          }}
                        />
                      ) : (
                        <div className="text-muted small">No image</div>
                      )}
                    </div>
                    <div className="card-body d-flex flex-column">
                      <h6 className="card-title mb-1">{c.category_name}</h6>
                      <div className="mt-auto d-flex gap-2">
                        <Link
                          className="btn btn-sm btn-outline-primary"
                          to={`/categories/${c.id}`}
                        >
                          View
                        </Link>
                        <Link
                          className="btn btn-sm btn-outline-secondary"
                          to={`/categories/${c.id}/edit`}
                        >
                          Edit
                        </Link>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => onDelete(c.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
