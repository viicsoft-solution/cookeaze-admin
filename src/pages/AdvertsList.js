// src/pages/AdvertsList.js
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://api.cookeaze.app/api";

export default function AdvertsList() {
  const [adverts, setAdverts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const navigate = useNavigate();

  // Create an axios instance using token from localStorage (keeps logic simple & local)
  const getApi = () => {
    const token = localStorage.getItem("token");
    return axios.create({
      baseURL: API_BASE,
      headers: {
        accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  };

  const fetchAdverts = async (q = "") => {
    setLoading(true);
    setStatus(null);
    const API = getApi();
    try {
      const url = q ? `/adverts/?search=${encodeURIComponent(q)}` : "/adverts/";
      const res = await API.get(url);
      // API wraps responses: { isSuccessful, message, data }
      setAdverts(res.data?.data || []);
    } catch (err) {
      console.error(err);
      setStatus({ type: "danger", text: "Failed to load adverts" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdverts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchAdverts(search);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this advert? This cannot be undone.")) return;
    setStatus(null);
    const API = getApi();
    try {
      await API.delete(`/adverts/${id}/`);
      setAdverts((prev) => prev.filter((a) => a.id !== id));
      setStatus({ type: "success", text: "Advert deleted." });
    } catch (err) {
      console.error(err);
      setStatus({ type: "danger", text: "Failed to delete advert." });
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Adverts</h3>
        <div>
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => fetchAdverts("")}
          >
            Refresh
          </button>
          <Link className="btn btn-primary" to="/adverts/create">
            Create Advert
          </Link>
        </div>
      </div>

      <form className="mb-3" onSubmit={handleSearch}>
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Search adverts by title, subtitle or text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn btn-outline-secondary" type="submit">
            Search
          </button>
        </div>
      </form>

      {status && (
        <div className={`alert alert-${status.type}`} role="alert">
          {status.text}
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div
            className="spinner-border text-primary"
            role="status"
            style={{ width: 50, height: 50 }}
          >
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <>
          {adverts.length === 0 ? (
            <div className="alert alert-secondary">No adverts found.</div>
          ) : (
            <div className="row g-3">
              {adverts.map((a) => (
                <div key={a.id} className="col-md-6 col-lg-4">
                  <div
                    className="card h-100 shadow-sm"
                    style={{ background: a.background_color_hex || "#fff" }}
                  >
                    {a.image_url ? (
                      <img
                        src={a.image_url}
                        className="card-img-top"
                        alt={a.title}
                        style={{ objectFit: "cover", height: 200 }}
                      />
                    ) : null}
                    <div className="card-body d-flex flex-column">
                      <h5 className="card-title">{a.title}</h5>
                      <p className="card-text text-muted small">{a.subtitle}</p>
                      <p className="flex-grow-1">
                        {a.main_text?.slice(0, 120)}
                        {a.main_text && a.main_text.length > 120 ? "…" : ""}
                      </p>

                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => navigate(`/adverts/${a.id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => navigate(`/adverts/${a.id}/edit`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger ms-auto"
                          onClick={() => handleDelete(a.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="card-footer text-muted small d-flex justify-content-between">
                      <div>{a.advert_type || "NORMAL"}</div>
                      <div>
                        {a.link_screen
                          ? a.link_screen
                          : a.link_url
                          ? "external"
                          : ""}
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
