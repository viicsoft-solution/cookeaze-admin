import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";

export default function AdvertForm({ mode = "create" }) {
  const { id } = useParams();
  const navigate = useNavigate();

  const API = axios.create({
    baseURL: "https://api.cookeaze.app/api",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${
        localStorage.getItem("token") || "YOUR_FALLBACK_TOKEN"
      }`,
    },
  });

  const [loading, setLoading] = useState(mode === "edit");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [serverResponse, setServerResponse] = useState(null);

  const [form, setForm] = useState({
    title: "",
    main_text: "",
    subtitle: "",
    button_text: "",
    image_url: "",
    background_color_hex: "#ffffff",
    advert_type: "NORMAL",
    recipe_id: null,
    link_screen: "",
    link_url: "",
  });

  // --- Recipe modal state ---
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [recipesNext, setRecipesNext] = useState(null);
  const [recipesCount, setRecipesCount] = useState(0);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState(null);
  const [recipeSearch, setRecipeSearch] = useState("");

  // refs to control and highlight inputs
  const linkUrlRef = useRef(null);
  const imageUrlRef = useRef(null);

  useEffect(() => {
    if (mode === "edit" && id) {
      (async () => {
        try {
          const res = await API.get(`/adverts/${id}/`);
          const data = res.data?.data || {};
          setForm({
            title: data.title || "",
            main_text: data.main_text || "",
            subtitle: data.subtitle || "",
            button_text: data.button_text || "",
            image_url: data.image_url || "",
            background_color_hex: data.background_color_hex || "#ffffff",
            advert_type: data.advert_type || "NORMAL",
            recipe_id: data.recipe_id ?? null,
            link_screen: data.link_screen || "",
            link_url: data.link_url || "",
          });

          setServerResponse(res.data);
          setStatus({
            type: "info",
            text: res.data?.message || "Loaded advert.",
          });
        } catch (err) {
          console.error(err);
          const payload = err?.response?.data ?? { message: err.message };
          setServerResponse(payload);
          setStatus({
            type: "danger",
            text: payload?.message || "Failed to load advert.",
          });
        } finally {
          setLoading(false);
        }
      })();
    }
    // eslint-disable-next-line
  }, [mode, id]);

  const handleChange = (field) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  function renderErrorDetails(data) {
    if (!data) return null;
    if (data.errors && typeof data.errors === "object") {
      const entries = Object.entries(data.errors);
      return (
        <div className="mt-2">
          <strong>Validation errors:</strong>
          <ul className="mb-0">
            {entries.map(([field, arr]) => (
              <li key={field}>
                <strong>{field}:</strong>{" "}
                {Array.isArray(arr) ? arr.join(", ") : JSON.stringify(arr)}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    return (
      <pre
        className="mt-2 p-2 bg-light border"
        style={{ maxHeight: 260, overflow: "auto", fontSize: 12 }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    setServerResponse(null);

    const payload = {
      title: form.title,
      main_text: form.main_text,
      subtitle: form.subtitle,
      button_text: form.button_text,
      image_url: form.image_url,
      background_color_hex: form.background_color_hex,
      advert_type: form.advert_type,
      recipe_id: form.recipe_id ? Number(form.recipe_id) : null,
      link_screen: form.link_screen,
      link_url: form.link_url,
    };

    try {
      if (mode === "create") {
        const res = await API.post("/adverts/", payload, {
          headers: { "Content-Type": "application/json" },
        });

        setStatus({
          type: "success",
          text: res.data?.message || "Advert created.",
        });
        setServerResponse(res.data);
        const created = res.data?.data;
        if (created && created.id) navigate(`/adverts/${created.id}`);
        else navigate("/adverts");
      } else {
        const res = await API.put(`/adverts/${id}/`, payload, {
          headers: { "Content-Type": "application/json" },
        });
        setStatus({
          type: "success",
          text: res.data?.message || "Advert updated.",
        });
        setServerResponse(res.data);
        navigate(`/adverts/${id}`);
      }
    } catch (err) {
      console.error(err);
      const payload = err?.response?.data ?? { message: err.message };
      setServerResponse(payload);
      setStatus({
        type: "danger",
        text: payload?.message || `Failed to save advert. ${err.message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  // --- Recipe fetching ---
  const openRecipeModal = () => {
    setShowRecipeModal(true);
    // load first page when opening
    if (recipes.length === 0) fetchRecipes();
  };

  const closeRecipeModal = () => setShowRecipeModal(false);

  const fetchRecipes = async (pageUrl = null) => {
    try {
      setRecipesLoading(true);
      setRecipesError(null);
      // If pageUrl is provided and absolute, use axios.get(pageUrl) directly. Otherwise use API.get
      const res = pageUrl
        ? await axios.get(pageUrl)
        : await API.get("/recipes/");
      const payload = res.data?.data ?? {};
      const results = payload.results || [];

      // Append if loading next page
      setRecipes((prev) => (pageUrl ? [...prev, ...results] : results));
      setRecipesNext(payload.next || null);
      setRecipesCount(payload.count || 0);
    } catch (err) {
      console.error(err);
      setRecipesError(
        err?.response?.data?.message || err.message || "Failed to load recipes"
      );
    } finally {
      setRecipesLoading(false);
    }
  };

  const loadMoreRecipes = () => {
    if (recipesNext) fetchRecipes(recipesNext);
  };

  const filteredRecipes = recipes.filter((r) =>
    r.name.toLowerCase().includes(recipeSearch.trim().toLowerCase())
  );

  const chooseRecipe = (recipe) => {
    // populate recipe_id and also copy the recipe's image into the Image URL field
    setForm((f) => ({
      ...f,
      recipe_id: recipe.id,
      image_url: recipe.image_url || f.image_url,
    }));

    setShowRecipeModal(false);
  };

  const chooseRecipeAsLink = (recipe) => {
    // construct a link to the public recipe page — modify if your app uses a different URL
    const link = `https://cookeaze.app/recipes/${recipe.id}`;
    setForm((f) => ({ ...f, link_url: link, recipe_id: null }));
    setShowRecipeModal(false);

    // highlight (focus + select) the Link URL input so the user can quickly copy/edit it
    setTimeout(() => {
      const el = linkUrlRef.current;
      if (el) {
        el.focus();
        if (typeof el.select === "function") el.select();
      }
    }, 0);
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>{mode === "create" ? "Create Advert" : "Edit Advert"}</h3>
        <div>
          <button
            className="btn btn-outline-secondary me-2"
            onClick={() => navigate(-1)}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            form="advertForm"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving..." : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </div>

      {status && (
        <div className={`alert alert-${status.type}`} role="alert">
          <div>{status.text}</div>
          {serverResponse && renderErrorDetails(serverResponse)}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      ) : (
        <form id="advertForm" onSubmit={handleSubmit}>
          <div className="row g-3">
            <div className="col-md-8">
              <div className="mb-3">
                <label className="form-label">Title</label>
                <input
                  className="form-control"
                  value={form.title}
                  onChange={handleChange("title")}
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Subtitle</label>
                <input
                  className="form-control"
                  value={form.subtitle}
                  onChange={handleChange("subtitle")}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Main text</label>
                <textarea
                  className="form-control"
                  rows="5"
                  value={form.main_text}
                  onChange={handleChange("main_text")}
                />
              </div>

              <div className="row">
                <div className="col-md-4 mb-3">
                  <label className="form-label">Button text</label>
                  <input
                    className="form-control"
                    value={form.button_text}
                    onChange={handleChange("button_text")}
                  />
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Advert type</label>
                  <select
                    className="form-select"
                    value={form.advert_type}
                    onChange={handleChange("advert_type")}
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="BANNER">BANNER</option>
                  </select>
                </div>

                <div className="col-md-4 mb-3">
                  <label className="form-label">Recipe ID (optional)</label>
                  <div className="input-group">
                    <input
                      className="form-control"
                      value={form.recipe_id ?? ""}
                      onChange={handleChange("recipe_id")}
                      type="number"
                    />
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={openRecipeModal}
                      title="Choose a recipe from the catalog"
                    >
                      Choose
                    </button>
                  </div>
                  <small className="form-text text-muted">
                    You can either enter a Recipe ID manually or choose one from
                    the catalog. When a recipe is chosen it will populate the
                    Recipe ID. If you prefer to link to the recipe page, choose
                    "Use link" inside the selector.
                  </small>
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Link URL</label>
                <input
                  className="form-control"
                  value={form.link_url}
                  onChange={handleChange("link_url")}
                />
                <small className="form-text text-muted">
                  Optional. If both Recipe ID and Link URL are provided, the API
                  payload will send the Recipe ID (preferred).
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label">Link screen</label>
                <input
                  className="form-control"
                  value={form.link_screen}
                  onChange={handleChange("link_screen")}
                />
              </div>
            </div>

            <div className="col-md-4">
              <div className="mb-3">
                <label className="form-label">Image URL</label>
                <input
                  className="form-control"
                  value={form.image_url}
                  onChange={handleChange("image_url")}
                />
                <small className="form-text text-muted">
                  Provide a public image URL.
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label">Background color</label>
                <input
                  type="color"
                  className="form-control form-control-color"
                  value={form.background_color_hex}
                  onChange={handleChange("background_color_hex")}
                />
              </div>

              <div className="mb-3">
                <label className="form-label">Preview</label>
                <div
                  className="border rounded p-2"
                  style={{
                    minHeight: 180,
                    background: form.background_color_hex,
                  }}
                >
                  {form.image_url ? (
                    <img
                      src={form.image_url}
                      alt="preview"
                      className="img-fluid rounded"
                      style={{ maxHeight: 140, objectFit: "cover" }}
                    />
                  ) : (
                    <div className="text-muted">No image provided</div>
                  )}
                  <div className="mt-2">
                    <strong>{form.title || "Title"}</strong>
                    <div className="small text-muted">{form.subtitle}</div>
                    <div className="mt-1">{form.main_text?.slice(0, 80)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* --- Recipe modal --- */}
      <div
        className={`modal ${showRecipeModal ? "d-block" : "d-none"}`}
        tabIndex={-1}
        role="dialog"
      >
        <div className="modal-dialog modal-lg" role="document">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Choose a Recipe</h5>
              <button
                type="button"
                className="btn-close"
                aria-label="Close"
                onClick={closeRecipeModal}
              ></button>
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <input
                  className="form-control"
                  placeholder="Search recipes by name..."
                  value={recipeSearch}
                  onChange={(e) => setRecipeSearch(e.target.value)}
                />
              </div>

              {recipesLoading && (
                <div className="text-center py-3">
                  <div className="spinner-border" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              )}

              {recipesError && (
                <div className="alert alert-danger">{recipesError}</div>
              )}

              {!recipesLoading && recipes.length === 0 && (
                <div className="text-muted">
                  No recipes loaded yet. Click "Refresh" to load.
                </div>
              )}

              <div className="list-group">
                {filteredRecipes.map((r) => (
                  <div
                    key={r.id}
                    className="list-group-item list-group-item-action d-flex align-items-start"
                  >
                    <img
                      src={r.image_url}
                      alt={r.name}
                      style={{
                        width: 84,
                        height: 60,
                        objectFit: "cover",
                        borderRadius: 6,
                      }}
                      className="me-3"
                    />
                    <div className="flex-grow-1">
                      <div className="d-flex justify-content-between">
                        <div>
                          <strong>{r.name}</strong>
                          <div className="small text-muted">
                            {r.category?.join(", ")}
                          </div>
                        </div>
                        <div className="text-end small text-muted">
                          {r.total_time ? `${r.total_time}m` : "-"}
                        </div>
                      </div>
                      <div className="mt-2 small">
                        {r.description?.slice(0, 120)}
                      </div>
                      <div className="mt-3">
                        <button
                          className="btn btn-sm btn-primary me-2"
                          onClick={() => chooseRecipe(r)}
                        >
                          Select (use ID)
                        </button>
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => chooseRecipeAsLink(r)}
                        >
                          Use link instead
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer d-flex justify-content-between">
              <div>
                <small className="text-muted">
                  Showing {recipes.length} of {recipesCount} recipes.
                </small>
              </div>
              <div>
                <button
                  type="button"
                  className="btn btn-secondary me-2"
                  onClick={() => fetchRecipes()}
                >
                  Refresh
                </button>
                {recipesNext && (
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={loadMoreRecipes}
                  >
                    Load more
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-link"
                  onClick={closeRecipeModal}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
