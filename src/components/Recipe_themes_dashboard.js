import React, { useState, useEffect } from "react";
import { Trash2, Edit, Plus, X, Save, Search, Eye } from "lucide-react";

const API_BASE_URL = "https://api.cookeaze.app/api/themes-recipes/";
const RECIPES_API_URL = "https://api.cookeaze.app/api/recipes/";

const RecipeThemesDashboard = () => {
  const [themes, setThemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentTheme, setCurrentTheme] = useState({
    id: null,
    name: "",
    image_url: "",
    color: 4279326582,
    recipes_id: [],
  });

  // Recipe selection states
  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [recipesError, setRecipesError] = useState(null);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [recipePage, setRecipePage] = useState(1);
  const [recipesCount, setRecipesCount] = useState(0);
  const [recipeViewMode, setRecipeViewMode] = useState("all"); // "all" | "selected"

  // ✅ NEW: Selected recipes (full details, not limited to current page)
  const [selectedRecipesDetails, setSelectedRecipesDetails] = useState([]);
  const [selectedLoading, setSelectedLoading] = useState(false);
  const [selectedError, setSelectedError] = useState(null);

  useEffect(() => {
    fetchThemes();
  }, []);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_BASE_URL, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch themes");
      const data = await response.json();
      setThemes(data.data?.results || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipes = async (page = 1, search = "") => {
    try {
      setRecipesLoading(true);
      let url = `${RECIPES_API_URL}?page=${page}`;
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch recipes");
      const data = await response.json();
      setRecipes(data.data?.results || []);
      setRecipesCount(data.data?.count || 0);
      setRecipesError(null);
    } catch (err) {
      setRecipesError(err.message);
    } finally {
      setRecipesLoading(false);
    }
  };

  // ✅ NEW: fetch full details for selected recipes (works across pages)
  const fetchSelectedRecipesDetails = async (ids = []) => {
    if (!ids.length) {
      setSelectedRecipesDetails([]);
      setSelectedError(null);
      return;
    }

    try {
      setSelectedLoading(true);
      setSelectedError(null);

      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`${RECIPES_API_URL}${id}/`, {
            headers: { accept: "application/json" },
          });
          if (!res.ok) throw new Error(`Failed to fetch recipe ${id}`);
          const json = await res.json();
          return json.data; // adjust if your backend returns recipe directly
        }),
      );

      setSelectedRecipesDetails(results.filter(Boolean));
    } catch (err) {
      setSelectedError(err.message);
    } finally {
      setSelectedLoading(false);
    }
  };

  const createTheme = async (themeData) => {
    try {
      const response = await fetch(API_BASE_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: themeData.name,
          image_url: themeData.image_url,
          color: parseInt(themeData.color),
          recipes_id: themeData.recipes_id.map((id) => parseInt(id)),
        }),
      });
      if (!response.ok) throw new Error("Failed to create theme");
      await fetchThemes();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateTheme = async (themeData) => {
    try {
      const response = await fetch(`${API_BASE_URL}${themeData.id}/`, {
        method: "PUT",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: themeData.name,
          image_url: themeData.image_url,
          color: parseInt(themeData.color),
          recipes_id: themeData.recipes_id.map((id) => parseInt(id)),
        }),
      });
      if (!response.ok) throw new Error("Failed to update theme");
      await fetchThemes();
      closeModal();
    } catch (err) {
      setError(err.message);
    }
  };

  const deleteTheme = async (id) => {
    if (!window.confirm("Are you sure you want to delete this theme?")) return;
    try {
      const response = await fetch(`${API_BASE_URL}${id}/`, {
        method: "DELETE",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Failed to delete theme");
      await fetchThemes();
    } catch (err) {
      setError(err.message);
    }
  };

  const openModal = (mode, theme = null) => {
    setModalMode(mode);

    if (theme) {
      const selectedIds = theme.recipes?.map((r) => r.id) || [];
      setCurrentTheme({
        id: theme.id,
        name: theme.name,
        image_url: theme.image_url,
        color: theme.color,
        recipes_id: selectedIds,
      });

      // keep selected details in sync if user opens and immediately clicks selected tab
      setSelectedRecipesDetails(theme.recipes || []);
      setSelectedError(null);
    } else {
      setCurrentTheme({
        id: null,
        name: "",
        image_url: "",
        color: 4279326582,
        recipes_id: [],
      });

      setSelectedRecipesDetails([]);
      setSelectedError(null);
    }

    setShowModal(true);
    setRecipeViewMode("all");
    setRecipePage(1);
    fetchRecipes(1, "");
  };

  const closeModal = () => {
    setShowModal(false);
    setCurrentTheme({
      id: null,
      name: "",
      image_url: "",
      color: 4279326582,
      recipes_id: [],
    });
    setRecipeViewMode("all");
    setRecipeSearch("");
    setRecipePage(1);

    // reset selected details
    setSelectedRecipesDetails([]);
    setSelectedLoading(false);
    setSelectedError(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    modalMode === "create"
      ? createTheme(currentTheme)
      : updateTheme(currentTheme);
  };

  // ✅ UPDATED: keep selected list in sync when removing/adding while on selected tab
  const toggleRecipeSelection = (recipeId) => {
    setCurrentTheme((prev) => {
      const exists = prev.recipes_id.includes(recipeId);
      const updatedIds = exists
        ? prev.recipes_id.filter((id) => id !== recipeId)
        : [...prev.recipes_id, recipeId];

      if (recipeViewMode === "selected") {
        fetchSelectedRecipesDetails(updatedIds);
      }

      return { ...prev, recipes_id: updatedIds };
    });
  };

  const colorToHex = (color) => {
    return (
      "#" + ("00000000" + (color >>> 0).toString(16)).slice(-8).substring(2)
    );
  };

  const totalPages = Math.ceil(recipesCount / 20);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-xl text-gray-600">Loading themes...</div>
      </div>
    );

  return (
    <div className="min-vh-100 bg-light p-4">
      <div className="container">
        <div className="bg-white rounded shadow-sm p-4 mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h1 className="h3 fw-bold text-dark">Recipe Themes Dashboard</h1>
            <button
              onClick={() => openModal("create")}
              className="btn btn-primary d-flex align-items-center gap-2"
            >
              <Plus size={20} />
              Create Theme
            </button>
          </div>

          <div className="position-relative">
            <Search
              className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted"
              size={20}
            />
            <input
              type="text"
              placeholder="Search themes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control ps-5"
            />
          </div>
        </div>

        {error && <div className="alert alert-danger">Error: {error}</div>}

        <div className="row g-4">
          {themes
            .filter((t) =>
              t.name.toLowerCase().includes(searchTerm.toLowerCase()),
            )
            .map((theme) => (
              <div key={theme.id} className="col-md-4">
                <div className="card shadow-sm border-0">
                  <img
                    src={theme.image_url}
                    alt={theme.name}
                    className="card-img-top"
                    style={{ height: "200px", objectFit: "cover" }}
                  />
                  <div className="card-body">
                    <h5 className="card-title">{theme.name}</h5>
                    <div className="d-flex gap-2 mt-2">
                      <button
                        onClick={() => openModal("view", theme)}
                        className="btn btn-outline-secondary flex-fill"
                      >
                        <Eye size={16} /> View
                      </button>
                      <button
                        onClick={() => openModal("edit", theme)}
                        className="btn btn-outline-primary flex-fill"
                      >
                        <Edit size={16} /> Edit
                      </button>
                      <button
                        onClick={() => deleteTheme(theme.id)}
                        className="btn btn-outline-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {showModal && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content border-0 shadow">
              <div className="modal-header">
                <h5 className="modal-title">
                  {modalMode === "create" ? "Create New Theme" : "Edit Theme"}
                </h5>
                <button onClick={closeModal} className="btn-close" />
              </div>

              <div className="modal-body">
                <form onSubmit={handleSubmit} className="vstack gap-3">
                  <div>
                    <label className="form-label">Theme Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={currentTheme.name}
                      onChange={(e) =>
                        setCurrentTheme({
                          ...currentTheme,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div>
                    <label className="form-label">Image URL *</label>
                    <input
                      type="url"
                      className="form-control"
                      value={currentTheme.image_url}
                      onChange={(e) =>
                        setCurrentTheme({
                          ...currentTheme,
                          image_url: e.target.value,
                        })
                      }
                      required
                    />
                    {currentTheme.image_url && (
                      <img
                        src={currentTheme.image_url}
                        alt="Preview"
                        className="img-fluid mt-2 rounded"
                        style={{ maxHeight: "200px" }}
                      />
                    )}
                  </div>

                  <div>
                    <label className="form-label">Color *</label>
                    <div className="d-flex align-items-center gap-3">
                      <input
                        type="number"
                        className="form-control"
                        value={currentTheme.color}
                        onChange={(e) =>
                          setCurrentTheme({
                            ...currentTheme,
                            color: parseInt(e.target.value) || 0,
                          })
                        }
                        required
                      />
                      <input
                        type="color"
                        className="form-control form-control-color"
                        value={colorToHex(currentTheme.color)}
                        onChange={(e) => {
                          const hex = e.target.value.replace("#", "");
                          const intColor = parseInt("FF" + hex, 16);
                          setCurrentTheme({ ...currentTheme, color: intColor });
                        }}
                        title="Pick color"
                      />
                      <div
                        className="border rounded"
                        style={{
                          width: "48px",
                          height: "40px",
                          backgroundColor: colorToHex(currentTheme.color),
                        }}
                      />
                    </div>
                  </div>

                  {/* Recipe Selection with Toggle */}
                  <div>
                    <label className="form-label fw-semibold">
                      Select Recipes
                    </label>

                    {/* Toggle Buttons */}
                    <div className="btn-group w-100 mb-3" role="group">
                      <button
                        type="button"
                        className={`btn ${
                          recipeViewMode === "selected"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => {
                          setRecipeViewMode("selected");
                          fetchSelectedRecipesDetails(currentTheme.recipes_id);
                        }}
                      >
                        Selected Recipes ({currentTheme.recipes_id.length})
                      </button>
                      <button
                        type="button"
                        className={`btn ${
                          recipeViewMode === "all"
                            ? "btn-primary"
                            : "btn-outline-primary"
                        }`}
                        onClick={() => setRecipeViewMode("all")}
                      >
                        All Recipes
                      </button>
                    </div>

                    {/* Selected Recipes View */}
                    {recipeViewMode === "selected" && (
                      <div className="border rounded p-3 bg-light">
                        {selectedLoading ? (
                          <div className="text-center text-muted py-4">
                            Loading selected recipes...
                          </div>
                        ) : selectedError ? (
                          <div className="alert alert-danger">
                            {selectedError}
                          </div>
                        ) : currentTheme.recipes_id.length > 0 ? (
                          <div className="vstack gap-2">
                            {selectedRecipesDetails.map((recipe) => (
                              <div
                                key={recipe.id}
                                className="d-flex align-items-center gap-3 bg-white p-2 rounded border"
                              >
                                <img
                                  src={recipe.image_url}
                                  alt={recipe.name}
                                  className="rounded"
                                  style={{
                                    width: "60px",
                                    height: "60px",
                                    objectFit: "cover",
                                  }}
                                />
                                <div className="flex-grow-1">
                                  <h6 className="mb-0">{recipe.name}</h6>
                                  <small className="text-muted">
                                    ID: {recipe.id}
                                  </small>
                                </div>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() =>
                                    toggleRecipeSelection(recipe.id)
                                  }
                                >
                                  <X size={16} /> Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center text-muted py-4">
                            <p className="mb-0">No recipes selected yet</p>
                            <small>
                              Switch to "All Recipes" to add recipes
                            </small>
                          </div>
                        )}
                      </div>
                    )}

                    {/* All Recipes View (Grid) */}
                    {recipeViewMode === "all" && (
                      <>
                        <div className="input-group mb-3">
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search recipes..."
                            value={recipeSearch}
                            onChange={(e) => setRecipeSearch(e.target.value)}
                          />
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => {
                              setRecipePage(1);
                              fetchRecipes(1, recipeSearch);
                            }}
                          >
                            <Search size={16} /> Search
                          </button>
                        </div>

                        {recipesLoading ? (
                          <div className="text-center py-4">
                            <div
                              className="spinner-border text-primary"
                              role="status"
                            >
                              <span className="visually-hidden">
                                Loading...
                              </span>
                            </div>
                          </div>
                        ) : recipesError ? (
                          <div className="alert alert-danger">
                            {recipesError}
                          </div>
                        ) : (
                          <div className="row g-3">
                            {recipes.map((r) => {
                              const selected = currentTheme.recipes_id.includes(
                                r.id,
                              );
                              return (
                                <div key={r.id} className="col-md-3">
                                  <div
                                    className={`card h-100 ${
                                      selected ? "border-success border-2" : ""
                                    }`}
                                  >
                                    <img
                                      src={r.image_url}
                                      alt={r.name}
                                      className="card-img-top"
                                      style={{
                                        height: "120px",
                                        objectFit: "cover",
                                      }}
                                    />
                                    <div className="card-body p-2">
                                      <h6
                                        className="mb-1 text-truncate"
                                        title={r.name}
                                      >
                                        {r.name}
                                      </h6>
                                      <small className="text-muted d-block mb-2">
                                        ID: {r.id}
                                      </small>
                                      <button
                                        type="button"
                                        className={`btn btn-sm w-100 ${
                                          selected
                                            ? "btn-outline-danger"
                                            : "btn-outline-success"
                                        }`}
                                        onClick={() =>
                                          toggleRecipeSelection(r.id)
                                        }
                                      >
                                        {selected ? (
                                          <>
                                            <X size={14} /> Remove
                                          </>
                                        ) : (
                                          <>
                                            <Plus size={14} /> Add
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {totalPages > 1 && (
                          <div className="d-flex justify-content-center align-items-center mt-3 gap-2">
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={recipePage <= 1}
                              onClick={() => {
                                const next = recipePage - 1;
                                setRecipePage(next);
                                fetchRecipes(next, recipeSearch);
                              }}
                            >
                              Prev
                            </button>
                            <span>
                              Page {recipePage} of {totalPages}
                            </span>
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm"
                              disabled={recipePage >= totalPages}
                              onClick={() => {
                                const next = recipePage + 1;
                                setRecipePage(next);
                                fetchRecipes(next, recipeSearch);
                              }}
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="d-flex gap-3 pt-3 border-top">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="btn btn-outline-secondary flex-fill"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary flex-fill d-flex align-items-center justify-content-center gap-2"
                    >
                      <Save size={20} />
                      {modalMode === "create" ? "Create Theme" : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipeThemesDashboard;
