// src/pages/AdvertDetail.js
import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAxiosInstance } from "../api";

export default function AdvertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const API = getAxiosInstance();

  const [advert, setAdvert] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAdvert = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/adverts/${id}/`);
      setAdvert(res.data?.data || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvert();
    // eslint-disable-next-line
  }, [id]);

  if (loading) return <div className="text-center py-5">Loading advert...</div>;
  if (!advert)
    return <div className="alert alert-warning">Advert not found.</div>;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h2 className="mb-0">{advert.title}</h2>
          <small className="text-muted">{advert.subtitle}</small>
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Back
          </button>
          <Link className="btn btn-primary" to={`/adverts/${advert.id}/edit`}>
            Edit
          </Link>
        </div>
      </div>

      <div
        className="card mb-4"
        style={{ background: advert.background_color_hex || "#fff" }}
      >
        {advert.image_url && (
          <img
            src={advert.image_url}
            className="card-img-top"
            alt={advert.title}
            style={{ maxHeight: 420, objectFit: "cover" }}
          />
        )}
        <div className="card-body">
          <p className="lead">{advert.main_text}</p>

          <div className="row">
            <div className="col-md-4">
              <strong>Button:</strong> {advert.button_text || "-"}
            </div>
            <div className="col-md-4">
              <strong>Type:</strong> {advert.advert_type || "NORMAL"}
            </div>
            <div className="col-md-4">
              <strong>Recipe ID:</strong> {advert.recipe_id ?? "-"}
            </div>
          </div>

          <hr />
          {advert.link_url ? (
            <a
              href={advert.link_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline-primary"
            >
              {advert.button_text || "Open link"}
            </a>
          ) : advert.link_screen ? (
            <div className="text-muted">Opens screen: {advert.link_screen}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
