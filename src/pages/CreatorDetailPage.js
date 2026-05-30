import React, { useEffect, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import axios from "axios";

const API_BASE = "https://api.cookeaze.app/api";

const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    Accept: "application/json",
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  else delete config.headers.Authorization;
  return config;
});

export default function CreatorDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const is_banned_from_state = location.state?.is_banned || false;
  
  const [creator, setCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [recipes, setRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(true);

  const [categoryFilter, setCategoryFilter] = useState("");
  const [categories, setCategories] = useState([]);
  
  // Recipes Pagination
  const [recipePage, setRecipePage] = useState(1);
  const [recipeTotalPages, setRecipeTotalPages] = useState(1);

  // Modal State for viewing single recipe
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [modalTab, setModalTab] = useState("ingredients");

  // Ban/Unban State
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  // Fetch Profile
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    
    axiosInstance.get(`/public/creators/${id}/`)
      .then((res) => {
        if (!mounted) return;
        const profileData = res.data?.data;
        if (profileData && profileData.is_banned === undefined) {
          profileData.is_banned = is_banned_from_state;
        }
        setCreator(profileData);
        if (profileData && profileData.categories) {
           setCategories(profileData.categories);
        }
      })
      .catch((err) => {
        console.error(err);
        if (mounted) {
          setError("Failed to load creator details. Please try again.");
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id]);

  // Fetch Recipes
  useEffect(() => {
    let mounted = true;
    setRecipesLoading(true);
    
    let recipesUrl = `/public/creators/${id}/recipes/?page=${recipePage}`;
    if (categoryFilter) {
      recipesUrl += `&category=${encodeURIComponent(categoryFilter)}`;
    }
      
    axiosInstance.get(recipesUrl)
      .then((res) => {
        if (!mounted) return;
        const data = res.data?.data;
        setRecipes(data?.results || []);
        
        // Attempt to calculate total pages (assuming default page size of 10)
        const count = data?.count || 0;
        setRecipeTotalPages(Math.max(1, Math.ceil(count / 10)));
      })
      .catch((err) => {
        console.error(err);
      })
      .finally(() => {
        if (mounted) setRecipesLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [id, categoryFilter, recipePage]);

  const handleCategoryChange = (e) => {
    setCategoryFilter(e.target.value);
    setRecipePage(1); // Reset to first page on filter change
  };

  const goToRecipePage = (p) => {
    if (p < 1 || p > recipeTotalPages) return;
    setRecipePage(p);
  };

  // Ban / Unban Handler
  const handleBanUnban = async (action) => {
    if (action === "ban" && !banReason.trim()) {
      alert("Please provide a reason for banning this creator.");
      return;
    }
    setBanLoading(true);
    try {
      const payload = { action };
      if (action === "ban") payload.reason = banReason;
      await axiosInstance.post(`/users/${id}/ban-creator/`, payload);
      alert(`Creator ${action === "ban" ? "banned" : "unbanned"} successfully!`);
      setShowBanModal(false);
      setBanReason("");
      // Update local creator state to reflect the change
      setCreator(prev => ({ ...prev, is_banned: action === "ban" }));
    } catch (err) {
      console.error(err);
      const msg = err?.response?.data?.message || `Failed to ${action} creator.`;
      alert(msg);
    } finally {
      setBanLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status" />
        <p className="mt-2 text-muted">Loading profile...</p>
      </div>
    );
  }

  if (error || !creator) {
    return (
      <div className="container py-5 text-center">
        <div className="alert alert-danger d-inline-block shadow-sm">
          {error || "Creator not found."}
        </div>
        <div>
          <Link to="/creators" className="btn btn-outline-secondary mt-3">
            &larr; Back to Creators
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4">
      {/* Back Link */}
      <div className="mb-4">
        <Link to="/creators" className="text-decoration-none text-muted">
          &larr; Back to System Creators
        </Link>
      </div>

      {/* Profile Header Card */}
      <div className="card border-0 shadow-sm mb-5 overflow-hidden">
        <div 
          className="card-header border-0 bg-primary bg-gradient" 
          style={{ height: 120 }}
        ></div>
        <div className="card-body px-4 pb-4 bg-white position-relative">
          <div className="d-flex flex-column flex-md-row position-relative" style={{ marginTop: -70 }}>
            <div className="me-4 mb-3 mb-md-0">
              <img
                src={creator.profile_picture_url || "https://via.placeholder.com/150"}
                alt={creator.creator_name}
                className="rounded-circle shadow border border-white border-4"
                style={{ width: 140, height: 140, objectFit: "cover", backgroundColor: "#fff" }}
              />
            </div>
            
            <div className="pt-md-5 pt-3 w-100">
              <h2 className="fw-bold mb-1">{creator.creator_name}</h2>
              <p className="text-muted d-flex align-items-center mb-3">
                <span className="me-3">
                  <strong>{creator.total_recipes}</strong> Published Recipes
                </span>
              </p>
              
              {creator.description && (
                <div className="bg-light p-3 rounded mb-3">
                  <h6 className="fw-bold fs-6 mb-2">About</h6>
                  <p className="mb-0 small text-secondary lh-lg">
                    {creator.description}
                  </p>
                </div>
              )}
              
              {creator.primary_cuisines && creator.primary_cuisines.length > 0 && (
                <div className="mt-3">
                  <h6 className="fw-bold fs-6 mb-2">Specialties</h6>
                  {creator.primary_cuisines.map((c, i) => (
                    <span key={i} className="badge bg-secondary me-1">
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ban/Unban Action Bar */}
          <div className="px-4 pb-4 d-flex justify-content-end gap-2 align-items-center">
            {creator.is_banned && (
              <span className="badge bg-danger rounded-pill px-3 py-2 me-auto">
                🚫 Creator is Banned
              </span>
            )}
            {creator.is_banned ? (
              <button
                className="btn btn-success rounded-pill px-4 fw-semibold"
                onClick={() => handleBanUnban("unban")}
                disabled={banLoading}
              >
                {banLoading ? (
                  <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Processing...</>
                ) : (
                  <>✅ Unban Creator</>
                )}
              </button>
            ) : (
              <button
                className="btn btn-outline-danger rounded-pill px-4 fw-semibold"
                onClick={() => { setShowBanModal(true); setBanReason(""); }}
              >
                🚫 Ban Creator
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Recipes Section */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3">
        <h4 className="fw-bold mb-0">Recipes by {creator.creator_name}</h4>
        
        <select
          className="form-select form-select-sm"
          style={{ width: "auto", minWidth: 150 }}
          value={categoryFilter}
          onChange={handleCategoryChange}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.name}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {recipesLoading ? (
        <div className="py-5 text-center w-100">
          <div className="spinner-border text-primary" role="status" />
        </div>
      ) : recipes.length > 0 ? (
        <>
          <div className="row g-3">
            {recipes.map((r) => (
              <div className="col-sm-6 col-md-4 col-lg-3" key={r.id}>
                <div 
                  className="card h-100 shadow-sm border-0" 
                  style={{ cursor: "pointer", transition: "transform 0.2s" }}
                  onClick={() => {
                    setSelectedRecipe(r);
                    setModalTab("ingredients");
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
                  onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                >
                  <img
                    src={r.image_url || "https://via.placeholder.com/300x200"}
                    className="card-img-top"
                    alt={r.name}
                    style={{ height: 160, objectFit: "cover" }}
                  />
                  <div className="card-body p-3 d-flex flex-column">
                    <h6 className="card-title fw-bold mb-1 text-truncate" title={r.name}>{r.name}</h6>
                    
                    <div className="small text-muted mb-2">
                      <div className="d-flex justify-content-between">
                        <span>⏱️ {r.total_time} mins</span>
                        <span>⭐ {r.rating}</span>
                      </div>
                    </div>
                    
                    <div className="mb-2">
                      {r.category && r.category.length > 0 && r.category.slice(0, 2).map((c, i) => (
                        <span key={i} className="badge bg-light text-dark me-1 border small">
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="mt-auto d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-success small">
                        {r.price ? `₦${r.price}` : "Free"}
                      </span>
                      {r.isExclusive && (
                        <span className="badge bg-warning text-dark small">Exclusive</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination Controls */}
          {recipeTotalPages > 1 && (
            <nav className="d-flex justify-content-center mt-4">
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${recipePage === 1 ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => goToRecipePage(recipePage - 1)}>
                    Prev
                  </button>
                </li>
                {[...Array(recipeTotalPages).keys()].map((n) => (
                  <li key={n} className={`page-item ${recipePage === n + 1 ? "active" : ""}`}>
                    <button className="page-link" onClick={() => goToRecipePage(n + 1)}>
                      {n + 1}
                    </button>
                  </li>
                ))}
                <li className={`page-item ${recipePage === recipeTotalPages ? "disabled" : ""}`}>
                  <button className="page-link" onClick={() => goToRecipePage(recipePage + 1)}>
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      ) : (
        <div className="card border-0 shadow-sm p-5 text-center">
          <p className="text-muted mb-0">No recipes found for this creator.</p>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <>
          <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
            <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
              <div className="modal-content">
                <div className="modal-header border-0 pb-0">
                  <h5 className="modal-title fw-bold text-truncate w-100">{selectedRecipe.name}</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={() => setSelectedRecipe(null)}
                    aria-label="Close"
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="d-flex mb-3 gap-2">
                    <button 
                      className={`btn btn-sm ${modalTab === "ingredients" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setModalTab("ingredients")}
                    >
                      Ingredients
                    </button>
                    <button 
                      className={`btn btn-sm ${modalTab === "steps" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setModalTab("steps")}
                    >
                      Steps
                    </button>
                  </div>

                  {modalTab === "ingredients" && (
                    <div>
                      {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 ? (
                        <ul className="list-group list-group-flush rounded border">
                          {selectedRecipe.ingredients.map(ing => (
                            <li className="list-group-item d-flex justify-content-between align-items-center" key={ing.id}>
                              <span>{ing.name}</span>
                              <span className="badge bg-light text-dark border">
                                {ing.quantity} {ing.unit !== "as needed" ? ing.unit : ""}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-muted text-center py-4">No ingredients provided.</p>
                      )}
                    </div>
                  )}

                  {modalTab === "steps" && (
                    <div>
                      {selectedRecipe.steps && selectedRecipe.steps.length > 0 ? (
                        <div className="list-group list-group-flush rounded border">
                          {selectedRecipe.steps.sort((a,b)=> a.step_number - b.step_number).map(step => (
                            <div className="list-group-item py-3" key={step.id}>
                              <div className="d-flex w-100 justify-content-between mb-2">
                                <h6 className="mb-0 fw-bold">Step {step.step_number} <span className="badge bg-secondary ms-2 fw-normal">{step.step_type}</span></h6>
                                <small className="text-muted">⏱️ {step.duration} mins</small>
                              </div>
                              <p className="mb-1 small text-dark" style={{ whiteSpace: "pre-wrap" }}>{step.description}</p>
                              {step.what_to_look_out_for && (
                                <div className="mt-2 p-2 bg-light border-start border-warning border-3 small">
                                  <strong>Look out for: </strong> {step.what_to_look_out_for}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted text-center py-4">No steps provided.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Ban Creator Modal */}
      {showBanModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg overflow-hidden">
              <div className="modal-header bg-danger text-white border-0 py-3 px-4">
                <h5 className="modal-title fw-bold mb-0">
                  <span className="me-2">🚫</span> Ban {creator.creator_name}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => { setShowBanModal(false); setBanReason(""); }}
                  disabled={banLoading}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="d-flex align-items-center gap-3 mb-4 p-3 bg-light rounded">
                  <img
                    src={creator.profile_picture_url || "https://via.placeholder.com/50"}
                    alt={creator.creator_name}
                    className="rounded-circle shadow-sm"
                    style={{ width: 50, height: 50, objectFit: "cover" }}
                  />
                  <div>
                    <h6 className="fw-bold mb-0">{creator.creator_name}</h6>
                    <small className="text-muted">{creator.total_recipes} recipes will be hidden</small>
                  </div>
                </div>

                <div className="alert alert-warning border-0 shadow-sm small mb-3">
                  <strong>⚠️ Warning:</strong> Banning this creator will hide all their recipes from the platform. This action can be reversed.
                </div>

                <label className="form-label fw-semibold">Reason for Ban <span className="text-danger">*</span></label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Explain why this creator is being banned..."
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  disabled={banLoading}
                ></textarea>
              </div>
              <div className="modal-footer border-0 px-4 pb-4 pt-0">
                <button
                  className="btn btn-light border px-4"
                  onClick={() => { setShowBanModal(false); setBanReason(""); }}
                  disabled={banLoading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-danger fw-bold px-4"
                  onClick={() => handleBanUnban("ban")}
                  disabled={banLoading || !banReason.trim()}
                >
                  {banLoading ? (
                    <><span className="spinner-border spinner-border-sm me-2" role="status"></span>Banning...</>
                  ) : (
                    "Confirm Ban"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
