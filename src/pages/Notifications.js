import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Bell,
  UtensilsCrossed,
  ChefHat,
  X,
  Search,
  CheckCircle,
  AlertCircle,
  Loader,
  Activity
} from "lucide-react";
import "bootstrap/dist/css/bootstrap.min.css";
import { useAuth } from "../contexts/AuthProvider"; // <-- added
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const API_BASE = "https://api.cookeaze.app/api";
// removed const AUTH_TOKEN

const NotificationAdmin = () => {
  const { token } = useAuth(); // <-- get token from context
  const [activeTab, setActiveTab] = useState("broadcast");
  const [loading, setLoading] = useState(false);

  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipes, setRecipes] = useState([]);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [deliveryStats, setDeliveryStats] = useState(null);
  const [notification, setNotification] = useState({ type: "", message: "" });

  // Ref for search input to maintain focus
  const searchInputRef = useRef(null);

  // Forms
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    body: "",
    image_url: "",
    custom_data: {},
  });

  const [mealForm, setMealForm] = useState({
    meal_type: "dinner",
    title: "",
    body: "",
    custom_data: {},
  });

  const [recipeForm, setRecipeForm] = useState({
    recipe_id: null,
    recipe_name: "",
    title: "",
    body: "",
    recipe_image_url: "",
    meal_type: "dinner",
    custom_data: {},
  });

  // ----------------------------------------------------------
  // SHOW MESSAGE
  // ----------------------------------------------------------
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification({ type: "", message: "" });
    }, 3500);
  };

  const handleTestStats = () => {
    setDeliveryStats({
      delivery: {
        total_devices: 2450,
        success_count: 2150,
        failure_count: 300,
        success_rate: 87.8
      }
    });
    showNotification("success", "Showing mock data for UI testing.");
  };

  // helper to build auth headers and handle missing token
  const getAuthHeaders = () => {
    if (!token) return null; // caller should handle null (not authenticated)
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  };

  // helper to parse different response shapes for recipes
  const extractRecipes = (data) => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data?.results)) return data.data.results;
    if (Array.isArray(data.data)) return data.data;
    // fallback: maybe the API returned single object or other structure
    return [];
  };

  // ----------------------------------------------------------
  // FETCH RECIPES - Only called explicitly
  // ----------------------------------------------------------
  const fetchRecipes = async (searchQuery = "") => {
    setLoadingRecipes(true);

    // ensure we have a token
    const headers = getAuthHeaders();
    if (!headers) {
      setLoadingRecipes(false);
      showNotification("error", "You are not authenticated. Please log in.");
      return;
    }

    try {
      const url = searchQuery
        ? `${API_BASE}/recipes/?search=${encodeURIComponent(searchQuery)}`
        : `${API_BASE}/recipes/`;

      const res = await fetch(url, {
        headers,
      });

      // if non-2xx, try to show a helpful error
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Fetch recipes failed", res.status, text);
        showNotification(
          "error",
          `Failed to fetch recipes (status ${res.status})`
        );
        setRecipes([]);
        return;
      }

      const data = await res.json();

      // extract recipes from possible shapes
      const extracted = extractRecipes(data);

      if (extracted.length > 0) {
        setRecipes(extracted);
      } else {
        // no recipes found — but still set to empty array so UI shows empty state
        setRecipes([]);
        // optionally notify the user only if search was used
        // showNotification("error", searchQuery ? "No recipes found." : "No recipes available.");
      }
    } catch (err) {
      console.error("fetchRecipes error:", err);
      showNotification("error", "Network error while fetching recipes");
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
      if (searchInputRef.current) {
        searchInputRef.current.focus();
      }
    }
  };

  // Fetch recipes only ONCE when modal opens
  useEffect(() => {
    if (showRecipeModal) {
      setRecipeSearch(""); // Clear search input
      fetchRecipes(""); // Load all recipes initially
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showRecipeModal]);

  // ----------------------------------------------------------
  // HANDLE SEARCH - Triggered by Enter key or search icon click
  // ----------------------------------------------------------
  const handleSearch = () => {
    fetchRecipes(recipeSearch);
  };

  // ----------------------------------------------------------
  // SELECT RECIPE
  // ----------------------------------------------------------
  const selectRecipe = (recipe) => {
    setRecipeForm({
      ...recipeForm,
      recipe_id: recipe.id,
      recipe_name: recipe.name,
      recipe_image_url: recipe.image_url,
    });
    setShowRecipeModal(false);
  };

  // ----------------------------------------------------------
  // SUBMIT helpers: updated to use token from context
  // ----------------------------------------------------------
  const postWithAuth = async (path, payload) => {
    const headers = getAuthHeaders();
    if (!headers) {
      throw new Error("Not authenticated");
    }

    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  };

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDeliveryStats(null);

    try {
      const { ok, data } = await postWithAuth(
        "/notifications/broadcast/",
        broadcastForm
      );

      if (ok && (data.success || data.isSuccessful)) {
        showNotification("success", "Broadcast notification sent!");
        setDeliveryStats(data.data || data);
        setBroadcastForm({
          title: "",
          body: "",
          image_url: "",
          custom_data: {},
        });
      } else {
        console.error("broadcast error", data);
        showNotification("error", data.message || "Failed to send broadcast");
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Network error");
    }

    setLoading(false);
  };

  const handleMealSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setDeliveryStats(null);

    try {
      const { ok, data } = await postWithAuth("/notifications/meal/", mealForm);

      if (ok && (data.success || data.isSuccessful)) {
        showNotification("success", "Meal notification sent!");
        setDeliveryStats(data.data || data);
        setMealForm({
          meal_type: "dinner",
          title: "",
          body: "",
          custom_data: {},
        });
      } else {
        console.error("meal error", data);
        showNotification(
          "error",
          data.message || "Failed to send meal notification"
        );
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Network error");
    }

    setLoading(false);
  };

  const handleRecipeSubmit = async (e) => {
    e.preventDefault();

    if (!recipeForm.recipe_id) {
      showNotification("error", "Please select a recipe");
      return;
    }

    setLoading(true);
    setDeliveryStats(null);

    try {
      const { ok, data } = await postWithAuth(
        "/notifications/recipe/",
        recipeForm
      );

      if (ok && (data.success || data.isSuccessful)) {
        showNotification("success", "Recipe notification sent!");
        setDeliveryStats(data.data || data);

        setRecipeForm({
          recipe_id: null,
          recipe_name: "",
          title: "",
          body: "",
          recipe_image_url: "",
          meal_type: "dinner",
          custom_data: {},
        });
      } else {
        console.error("recipe notif error", data);
        showNotification(
          "error",
          data.message || "Failed to send recipe notification"
        );
      }
    } catch (err) {
      console.error(err);
      showNotification("error", "Network error");
    }

    setLoading(false);
  };

  // ----------------------------------------------------------
  // DELIVERY STATS CARD
  // ----------------------------------------------------------
  const DeliveryStatsCard = ({ stats }) => {
    if (!stats) return null;

    // The API might return these fields inside an object (e.g., stats.delivery) or at the top level
    const data = stats.delivery || stats;

    const total = data.total_devices ?? data.total ?? 0;
    const success = data.success_count ?? data.success ?? 0;
    const failure = data.failure_count ?? data.failure ?? (total - success) ?? 0;
    const rate = data.success_rate ?? (total > 0 ? ((success / total) * 100).toFixed(1) : 0);

    const chartData = {
      labels: ["Success", "Failed"],
      datasets: [
        {
          data: [success, failure],
          backgroundColor: ["#198754", "#dc3545"],
          hoverBackgroundColor: ["#157347", "#bb2d3b"],
          borderWidth: 0,
        },
      ],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 20,
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.raw || 0;
              const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      },
    };

    return (
      <div className="card mt-4 border-0 shadow-sm" style={{ borderRadius: "16px", overflow: "hidden" }}>
        <div className="card-header bg-white border-bottom-0 pt-4 pb-2 px-4 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 text-dark d-flex align-items-center fw-bold">
            <Activity size={22} className="me-2 text-primary" />
            Delivery Report Overview
          </h5>
          <button type="button" className="btn-close" aria-label="Close" onClick={() => setDeliveryStats(null)}></button>
        </div>

        <div className="card-body p-4 bg-white">
          <div className="row g-4 align-items-center">
            {/* Chart Section */}
            <div className="col-12 col-md-5 col-lg-4 text-center">
              <div style={{ height: "220px", width: "100%", position: "relative" }}>
                {total > 0 ? (
                  <Pie data={chartData} options={chartOptions} />
                ) : (
                  <div className="d-flex h-100 align-items-center justify-content-center text-muted flex-column">
                    <AlertCircle size={40} className="mb-2 opacity-50" />
                    <p className="mb-0">No data to display</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats Section */}
            <div className="col-12 col-md-7 col-lg-8">
              <div className="row g-3">
                {/* Total Devices */}
                <div className="col-6 col-sm-6">
                  <div className="p-3 rounded-4 h-100 shadow-sm" style={{ background: "linear-gradient(145deg, #f8f9fa, #e9ecef)", border: "1px solid #dee2e6" }}>
                    <div className="text-muted fw-bold mb-1" style={{ fontSize: "0.75rem", letterSpacing: "1px", textTransform: "uppercase" }}>Total Devices</div>
                    <h3 className="mb-0 fw-bold text-secondary">{total.toLocaleString()}</h3>
                  </div>
                </div>

                {/* Success Rate */}
                <div className="col-6 col-sm-6">
                  <div className="p-3 rounded-4 h-100 shadow-sm" style={{ background: "linear-gradient(145deg, #cce5ff, #b8daff)", border: "1px solid #b8daff" }}>
                    <div className="text-primary fw-bold mb-1" style={{ fontSize: "0.75rem", letterSpacing: "1px", textTransform: "uppercase" }}>Success Rate</div>
                    <h3 className="mb-0 fw-bold text-primary">{rate}%</h3>
                  </div>
                </div>

                {/* Success Count */}
                <div className="col-6 col-sm-6">
                  <div className="p-3 rounded-4 h-100 shadow-sm" style={{ background: "linear-gradient(145deg, #d4edda, #c3e6cb)", border: "1px solid #c3e6cb" }}>
                    <div className="text-success fw-bold mb-1" style={{ fontSize: "0.75rem", letterSpacing: "1px", textTransform: "uppercase" }}>Delivered</div>
                    <h3 className="mb-0 fw-bold text-success">{success.toLocaleString()}</h3>
                  </div>
                </div>

                {/* Failure Count */}
                <div className="col-6 col-sm-6">
                  <div className="p-3 rounded-4 h-100 shadow-sm" style={{ background: "linear-gradient(145deg, #f8d7da, #f5c6cb)", border: "1px solid #f5c6cb" }}>
                    <div className="text-danger fw-bold mb-1" style={{ fontSize: "0.75rem", letterSpacing: "1px", textTransform: "uppercase" }}>Failed</div>
                    <h3 className="mb-0 fw-bold text-danger">{failure.toLocaleString()}</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------------
  // RECIPE MODAL
  // ----------------------------------------------------------
  const RecipeModal = () => {
    if (!showRecipeModal) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="modal-backdrop fade show"
          style={{
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 9998,
          }}
        />

        {/* Modal */}
        <div
          className="modal d-block"
          tabIndex="-1"
          style={{
            zIndex: 9999,
          }}
        >
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header bg-danger text-white">
                <h5 className="modal-title d-flex align-items-center">
                  <ChefHat className="me-2" /> Select Recipe
                </h5>
                <button
                  className="btn-close btn-close-white"
                  onClick={() => setShowRecipeModal(false)}
                />
              </div>

              <div className="modal-body p-0">
                {/* Search Bar */}
                <div className="p-3 bg-light border-bottom">
                  <div className="input-group">
                    <input
                      ref={searchInputRef}
                      className="form-control"
                      placeholder="Type and press Enter or click search"
                      value={recipeSearch}
                      onChange={(e) => setRecipeSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSearch();
                        }
                      }}
                      autoComplete="off"
                      autoFocus
                    />
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={handleSearch}
                      disabled={loadingRecipes}
                    >
                      <Search size={20} />
                    </button>
                  </div>
                </div>

                {/* Recipe List */}
                <div
                  style={{ maxHeight: "60vh", overflowY: "auto" }}
                  className="p-3"
                >
                  {loadingRecipes ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-danger"></div>
                      <p className="mt-2 text-muted">Loading recipes...</p>
                    </div>
                  ) : recipes.length === 0 ? (
                    <div className="text-center py-5">
                      <AlertCircle size={48} className="text-muted mb-3" />
                      <p className="text-muted">
                        {recipeSearch
                          ? "No recipes found. Try a different search."
                          : "No recipes available."}
                      </p>
                    </div>
                  ) : (
                    <div className="list-group">
                      {recipes.map((recipe) => (
                        <button
                          key={recipe.id}
                          className="list-group-item list-group-item-action d-flex gap-3 align-items-center"
                          onClick={() => selectRecipe(recipe)}
                          style={{
                            cursor: "pointer",
                            borderRadius: "8px",
                            padding: "10px",
                            marginBottom: "8px",
                          }}
                        >
                          <img
                            src={recipe.image_url}
                            alt={recipe.name}
                            style={{
                              width: 70,
                              height: 70,
                              objectFit: "cover",
                              borderRadius: "6px",
                            }}
                          />

                          <div className="flex-grow-1 text-start">
                            <div className="fw-semibold">{recipe.name}</div>

                            <div className="d-flex gap-2 mt-1">
                              <span className="badge bg-warning text-dark">
                                ⭐ {recipe.rating}
                              </span>
                              <span className="badge bg-secondary">
                                ⏱ {recipe.total_time}m
                              </span>
                              <span className="badge bg-info">
                                🍽 {recipe.servings}
                              </span>
                            </div>

                            <small className="text-muted d-block mt-1">
                              {recipe.description?.slice(0, 60)}...
                            </small>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  // ----------------------------------------------------------
  // MAIN RENDER
  // ----------------------------------------------------------
  return (
    <>
      <style>{`
        .recipe-card-hover {
          cursor: pointer;
          transition: .2s;
        }
        .recipe-card-hover:hover {
          transform: scale(1.02);
          box-shadow: 0 3px 8px rgba(0,0,0,.2);
        }
      `}</style>

      <RecipeModal />

      <div className="bg-light min-vh-100 py-4">
        <div className="container">
          {/* Header */}
          <div className="mb-4">
            <h1 className="display-5 fw-bold d-flex align-items-center gap-3">
              <Bell className="text-danger" size={40} />
              CookEaze Notification Admin
            </h1>
            <p className="text-muted">Manage and send push notifications</p>
          </div>

          {/* Alert */}
          {notification.message && (
            <div
              className={`alert alert-${
                notification.type === "success" ? "success" : "danger"
              } d-flex align-items-center`}
            >
              {notification.type === "success" ? (
                <CheckCircle className="me-2" />
              ) : (
                <AlertCircle className="me-2" />
              )}
              {notification.message}
            </div>
          )}

          {/* Tabs */}
          <ul className="nav nav-tabs mb-4">
            <li className="nav-item">
              <button
                className={`nav-link ${
                  activeTab === "broadcast" ? "active" : ""
                }`}
                onClick={() => setActiveTab("broadcast")}
              >
                <Send size={18} className="me-2" />
                Broadcast
              </button>
            </li>

            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === "meal" ? "active" : ""}`}
                onClick={() => setActiveTab("meal")}
              >
                <UtensilsCrossed size={18} className="me-2" />
                Meal Reminder
              </button>
            </li>

            <li className="nav-item">
              <button
                className={`nav-link ${activeTab === "recipe" ? "active" : ""}`}
                onClick={() => setActiveTab("recipe")}
              >
                <ChefHat size={18} className="me-2" />
                Recipe Feature
              </button>
            </li>
          </ul>

          {/* FORMS CARD */}
          <div className="card shadow">
            <div className="card-body p-4">
              {/* BROADCAST */}
              {activeTab === "broadcast" && (
                <form onSubmit={handleBroadcastSubmit}>
                  <h4 className="mb-4">Broadcast Notification</h4>

                  {/* Title */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Title</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={broadcastForm.title}
                      onChange={(e) =>
                        setBroadcastForm({
                          ...broadcastForm,
                          title: e.target.value,
                        })
                      }
                      placeholder="🎉 Weekend Sale!"
                    />
                  </div>

                  {/* Body */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Body</label>
                    <textarea
                      className="form-control"
                      required
                      rows="3"
                      value={broadcastForm.body}
                      onChange={(e) =>
                        setBroadcastForm({
                          ...broadcastForm,
                          body: e.target.value,
                        })
                      }
                      placeholder="Get 20% off premium recipes this weekend only!"
                    />
                  </div>

                  {/* Image */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Image URL (optional)
                    </label>
                    <input
                      type="url"
                      className="form-control"
                      value={broadcastForm.image_url}
                      onChange={(e) =>
                        setBroadcastForm({
                          ...broadcastForm,
                          image_url: e.target.value,
                        })
                      }
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  {/* JSON */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Custom Data (JSON)
                    </label>
                    <textarea
                      className="form-control font-monospace"
                      rows="3"
                      value={JSON.stringify(broadcastForm.custom_data, null, 2)}
                      onChange={(e) => {
                        try {
                          setBroadcastForm({
                            ...broadcastForm,
                            custom_data: JSON.parse(e.target.value),
                          });
                        } catch {}
                      }}
                      placeholder='{"key": "value"}'
                    />
                  </div>

                  {/* Submit */}
                  <div className="d-flex gap-2">
                    <button className="btn btn-danger flex-grow-1" disabled={loading}>
                      {loading ? "Sending..." : "Send Broadcast"}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={handleTestStats}
                    >
                      Test UI
                    </button>
                  </div>

                  <DeliveryStatsCard stats={deliveryStats} />
                </form>
              )}

              {/* MEAL TAB */}
              {activeTab === "meal" && (
                <form onSubmit={handleMealSubmit}>
                  <h4 className="mb-4">Meal Notification</h4>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Meal Type</label>
                    <select
                      className="form-select"
                      value={mealForm.meal_type}
                      onChange={(e) =>
                        setMealForm({ ...mealForm, meal_type: e.target.value })
                      }
                    >
                      <option value="breakfast">breakfast</option>
                      <option value="lunch">lunch</option>
                      <option value="dinner">dinner</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Title</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={mealForm.title}
                      onChange={(e) =>
                        setMealForm({ ...mealForm, title: e.target.value })
                      }
                      placeholder="What's for Dinner? 🍽️"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">Body</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      required
                      value={mealForm.body}
                      onChange={(e) =>
                        setMealForm({ ...mealForm, body: e.target.value })
                      }
                      placeholder="Let's find a delicious recipe to end the day!"
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Custom Data (JSON)
                    </label>
                    <textarea
                      className="form-control font-monospace"
                      rows="3"
                      value={JSON.stringify(mealForm.custom_data, null, 2)}
                      onChange={(e) => {
                        try {
                          setMealForm({
                            ...mealForm,
                            custom_data: JSON.parse(e.target.value),
                          });
                        } catch {}
                      }}
                      placeholder='{"campaign": "evening_reminder"}'
                    />
                  </div>

                  <div className="d-flex gap-2">
                    <button className="btn btn-danger flex-grow-1" disabled={loading}>
                      {loading ? "Sending..." : "Send Meal Reminder"}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={handleTestStats}
                    >
                      Test UI
                    </button>
                  </div>

                  <DeliveryStatsCard stats={deliveryStats} />
                </form>
              )}

              {/* RECIPE TAB */}
              {activeTab === "recipe" && (
                <form onSubmit={handleRecipeSubmit}>
                  <h4 className="mb-4">Recipe Feature Notification</h4>

                  {/* Selected Recipe */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Selected Recipe
                    </label>
                    <div className="d-flex gap-2">
                      {recipeForm.recipe_id ? (
                        <div className="border p-3 bg-light rounded flex-grow-1">
                          <div className="d-flex gap-3 align-items-center">
                            <img
                              src={recipeForm.recipe_image_url}
                              alt={recipeForm.recipe_name}
                              style={{
                                width: 80,
                                height: 80,
                                objectFit: "cover",
                              }}
                              className="rounded"
                            />
                            <div>
                              <div className="fw-semibold">
                                {recipeForm.recipe_name}
                              </div>
                              <small className="text-muted">
                                ID: {recipeForm.recipe_id}
                              </small>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="border p-3 bg-light rounded flex-grow-1 text-muted text-center">
                          No recipe selected
                        </div>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => setShowRecipeModal(true)}
                      >
                        Select Recipe
                      </button>
                    </div>
                  </div>

                  {/* Meal Type */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Meal Type</label>
                    <select
                      className="form-select"
                      value={recipeForm.meal_type}
                      onChange={(e) =>
                        setRecipeForm({
                          ...recipeForm,
                          meal_type: e.target.value,
                        })
                      }
                    >
                      <option value="breakfast">breakfast</option>
                      <option value="lunch">lunch</option>
                      <option value="dinner">dinner</option>
                    </select>
                  </div>

                  {/* Title */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Title</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={recipeForm.title}
                      onChange={(e) =>
                        setRecipeForm({ ...recipeForm, title: e.target.value })
                      }
                      placeholder="Try This Delicious Recipe! 🍝"
                    />
                  </div>

                  {/* Body */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">Body</label>
                    <textarea
                      rows="3"
                      className="form-control"
                      required
                      value={recipeForm.body}
                      onChange={(e) =>
                        setRecipeForm({ ...recipeForm, body: e.target.value })
                      }
                      placeholder="Perfect for a quick weeknight dinner"
                    />
                  </div>

                  {/* Custom Data */}
                  <div className="mb-3">
                    <label className="form-label fw-semibold">
                      Custom Data (JSON)
                    </label>
                    <textarea
                      className="form-control font-monospace"
                      rows={3}
                      value={JSON.stringify(recipeForm.custom_data, null, 2)}
                      onChange={(e) => {
                        try {
                          setRecipeForm({
                            ...recipeForm,
                            custom_data: JSON.parse(e.target.value),
                          });
                        } catch {}
                      }}
                      placeholder='{"featured": true, "difficulty": "easy"}'
                    />
                  </div>

                  {/* Submit */}
                  <div className="d-flex gap-2">
                    <button className="btn btn-danger flex-grow-1" disabled={loading}>
                      {loading ? "Sending..." : "Send Recipe Notification"}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-outline-secondary"
                      onClick={handleTestStats}
                    >
                      Test UI
                    </button>
                  </div>

                  <DeliveryStatsCard stats={deliveryStats} />
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default NotificationAdmin;
