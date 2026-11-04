import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  Clock,
  Star,
  Eye,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import {
  saveBannedCreatorRecord,
  removeBannedCreatorRecord,
} from "./CreatorsPage";
import "./Creators.css";

const BAN_REASON_PRESETS = [
  "Violation of community recipe guidelines",
  "Repeated copyright or stolen food photography",
  "Spam or misleading culinary content",
];

function getInitials(name) {
  const clean = String(name || "Creator").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function CreatorDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const api = useMemo(() => getAxiosInstance(), []);

  const isBannedFromState = Boolean(location.state?.is_banned);
  const creatorFromState = location.state?.creator || null;

  const [creator, setCreator] = useState(creatorFromState);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(!creatorFromState);
  const [recipesLoading, setRecipesLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const [recipePage, setRecipePage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState("");

  // Recipe Inspection Modal
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Ban / Unban Modal
  const [banModalOpen, setBanModalOpen] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [banLoading, setBanLoading] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const fetchCreatorProfile = useCallback(async () => {
    if (!creatorFromState) setLoading(true);
    try {
      const res = await api.get(`/public/creators/${id}/`);
      const data = res.data?.data ?? res.data;
      if (data) {
        setCreator((prev) => ({
          ...(prev || {}),
          ...data,
          is_banned:
            typeof data.is_banned === "boolean"
              ? data.is_banned
              : isBannedFromState || Boolean(prev?.is_banned),
        }));
      }
    } catch (err) {
      if (!creatorFromState) {
        showToast(
          "error",
          err.response?.data?.message || "Failed to load creator profile."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [api, id, isBannedFromState, creatorFromState, showToast]);

  const fetchCreatorRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const res = await api.get(`/public/creators/${id}/recipes/`, {
        params: {
          page: recipePage,
          category: categoryFilter || undefined,
        },
      });
      const list = res.data?.data ?? [];
      setRecipes(Array.isArray(list) ? list : []);
      setTotalPages(res.data?.pagination?.total_pages || 1);
    } catch (err) {
      setRecipes([]);
      if (!isBannedFromState) {
        showToast(
          "error",
          err.response?.data?.message || "Failed to load creator recipes."
        );
      }
    } finally {
      setRecipesLoading(false);
    }
  }, [api, id, recipePage, categoryFilter, isBannedFromState, showToast]);

  useEffect(() => {
    fetchCreatorProfile();
  }, [fetchCreatorProfile]);

  useEffect(() => {
    fetchCreatorRecipes();
  }, [fetchCreatorRecipes]);

  const handleToggleBan = async () => {
    if (!creator) return;
    const isUnban = Boolean(creator.is_banned);

    if (!isUnban && !banReason.trim()) {
      showToast("error", "Please enter or select a reason for banning.");
      return;
    }

    setBanLoading(true);
    try {
      const payload = {
        action: isUnban ? "unban" : "ban",
        ...(isUnban ? {} : { reason: banReason.trim() }),
      };

      const res = await api.post(`/users/${creator.id}/ban-creator/`, payload);
      if (res.data?.status === "success" || res.status === 200) {
        if (isUnban) {
          removeBannedCreatorRecord(creator.id);
        } else {
          saveBannedCreatorRecord(creator, banReason.trim());
        }
        setCreator((prev) => ({
          ...prev,
          is_banned: !isUnban,
          ban_reason: isUnban ? "" : banReason.trim(),
        }));
        setBanModalOpen(false);
        setBanReason("");
        showToast(
          "success",
          isUnban
            ? `Restored ${creator.creator_name} to active status.`
            : `Banned ${creator.creator_name}.`
        );
      }
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to update creator standing."
      );
    } finally {
      setBanLoading(false);
    }
  };

  return (
    <div className="cr-page">
      {/* Top Bar */}
      <div className="cr-header">
        <div className="cr-header-left">
          <div>
            <button
              type="button"
              className="cr-btn cr-btn-secondary cr-btn-sm"
              onClick={() => navigate("/creators")}
            >
              <ArrowLeft size={14} />
              Back to Creators
            </button>
          </div>
          <h1 className="cr-title" style={{ marginTop: 6 }}>
            {creator?.creator_name || "Creator Profile"}
          </h1>
          <p className="cr-subtitle">
            Review published recipes, culinary categories, and account moderation controls.
          </p>
        </div>
      </div>

      {/* Toast Feedback */}
      {toast && (
        <div className={`cr-toast ${toast.type}`}>
          <div className="cr-toast-left">
            {toast.type === "error" ? (
              <AlertCircle size={17} />
            ) : (
              <CheckCircle2 size={17} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="cr-toast-close"
            onClick={() => setToast(null)}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {loading ? (
        <div className="cr-profile-hero">
          <div className="cr-profile-hero-left">
            <div
              className="cr-shimmer"
              style={{ width: 88, height: 88, borderRadius: "50%" }}
            />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <div
                  className="cr-shimmer"
                  style={{ width: 170, height: 22 }}
                />
                <div
                  className="cr-shimmer"
                  style={{ width: 100, height: 22, borderRadius: 999 }}
                />
              </div>
              <div
                className="cr-shimmer"
                style={{ width: "80%", height: 14 }}
              />
              <div
                className="cr-shimmer"
                style={{ width: "55%", height: 14 }}
              />
            </div>
          </div>
          <div
            className="cr-shimmer"
            style={{ width: 120, height: 38, borderRadius: 9 }}
          />
        </div>
      ) : !creator ? (
        <div className="cr-empty">
          <h4>Creator not found</h4>
          <button
            type="button"
            className="cr-btn cr-btn-secondary"
            onClick={() => navigate("/creators")}
          >
            Return to Creators
          </button>
        </div>
      ) : (
        <>
          {/* Creator Hero Card */}
          <div className="cr-profile-hero">
            <div className="cr-profile-hero-left">
              {creator.profile_picture_url && !avatarBroken ? (
                <img
                  src={creator.profile_picture_url}
                  alt={creator.creator_name}
                  className="cr-avatar lg"
                  onError={() => setAvatarBroken(true)}
                />
              ) : (
                <div className="cr-avatar lg">
                  {getInitials(creator.creator_name)}
                </div>
              )}

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    {creator.creator_name}
                  </h2>
                  <span
                    className={`cr-badge ${
                      creator.is_banned ? "banned" : "active"
                    }`}
                  >
                    {creator.is_banned ? "Banned Creator" : "Verified Creator"}
                  </span>
                  <span className="cr-badge neutral">
                    <BookOpen size={12} />
                    {creator.total_recipes || recipes.length || 0} Published Recipes
                  </span>
                </div>

                <p
                  style={{
                    margin: "10px 0 0 0",
                    fontSize: "0.88rem",
                    color: "#475569",
                    lineHeight: 1.55,
                  }}
                >
                  {creator.description ||
                    creator.bio ||
                    "This creator has not added a biography yet."}
                </p>

                {Array.isArray(creator.recipe_categories) &&
                  creator.recipe_categories.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 14,
                      }}
                    >
                      <button
                        type="button"
                        className="cr-reason-pill"
                        style={
                          categoryFilter === ""
                            ? {
                                background: "#129575",
                                color: "#ffffff",
                                borderColor: "#129575",
                              }
                            : undefined
                        }
                        onClick={() => {
                          setCategoryFilter("");
                          setRecipePage(1);
                        }}
                      >
                        All Categories
                      </button>
                      {creator.recipe_categories
                        .filter(
                          (cat) =>
                            !["souschef", "souchef"].includes(
                              String(cat).trim().toLowerCase()
                            )
                        )
                        .map((cat, idx) => (
                          <button
                            key={idx}
                            type="button"
                            className="cr-reason-pill"
                            style={
                              categoryFilter === cat
                                ? {
                                    background: "#129575",
                                    color: "#ffffff",
                                    borderColor: "#129575",
                                  }
                                : undefined
                            }
                            onClick={() => {
                              setCategoryFilter(cat);
                              setRecipePage(1);
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                    </div>
                  )}
              </div>
            </div>

            <div>
              <button
                type="button"
                className={`cr-btn ${
                  creator.is_banned ? "cr-btn-soft" : "cr-btn-danger-ghost"
                }`}
                onClick={() => setBanModalOpen(true)}
              >
                {creator.is_banned ? (
                  <>
                    <ShieldCheck size={15} />
                    Unban Creator
                  </>
                ) : (
                  <>
                    <ShieldAlert size={15} />
                    Ban Creator
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Creator Recipes Section */}
          <div className="cr-toolbar">
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a" }}>
              Published Recipes{" "}
              {categoryFilter && (
                <span style={{ color: "#129575" }}>· {categoryFilter}</span>
              )}
            </div>

            {categoryFilter && (
              <button
                type="button"
                className="cr-btn cr-btn-secondary cr-btn-sm"
                onClick={() => {
                  setCategoryFilter("");
                  setRecipePage(1);
                }}
              >
                <X size={13} />
                Clear Filter
              </button>
            )}
          </div>

          {recipesLoading ? (
            <div className="cr-recipe-grid">
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} className="cr-recipe-card">
                  <div
                    className="cr-recipe-media cr-shimmer"
                    style={{ borderRadius: 0 }}
                  />
                  <div className="cr-recipe-body">
                    <div
                      className="cr-shimmer"
                      style={{ width: "75%", height: 15 }}
                    />
                    <div
                      className="cr-shimmer"
                      style={{ width: "52%", height: 12 }}
                    />
                    <div style={{ marginTop: "auto", paddingTop: 10 }}>
                      <div
                        className="cr-shimmer"
                        style={{ width: "100%", height: 32 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : recipes.length === 0 ? (
            <div className="cr-empty">
              <BookOpen size={26} style={{ color: "#94a3b8" }} />
              <h4>No recipes found</h4>
              <p>
                {categoryFilter
                  ? `No recipes found in "${categoryFilter}".`
                  : "This creator has not published any recipes yet."}
              </p>
            </div>
          ) : (
            <div className="cr-recipe-grid">
              {recipes.map((recipe) => (
                <div key={recipe.id} className="cr-recipe-card">
                  <div className="cr-recipe-media">
                    {recipe.image_url ? (
                      <img src={recipe.image_url} alt={recipe.name} />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#94a3b8",
                        }}
                      >
                        <ImageIcon size={24} />
                      </div>
                    )}
                  </div>
                  <div className="cr-recipe-body">
                    <h3 className="cr-recipe-title">{recipe.name}</h3>
                    <div className="cr-recipe-meta">
                      <span>
                        <Clock size={12} style={{ marginRight: 4 }} />
                        {recipe.total_time || 0} mins
                      </span>
                      <span>
                        <Star
                          size={12}
                          style={{ marginRight: 4, color: "#f59e0b" }}
                        />
                        {recipe.average_rating ?? "New"}
                      </span>
                    </div>

                    <div style={{ marginTop: "auto", paddingTop: 10 }}>
                      <button
                        type="button"
                        className="cr-btn cr-btn-secondary cr-btn-sm"
                        style={{ width: "100%" }}
                        onClick={() => setSelectedRecipe(recipe)}
                      >
                        <Eye size={13} />
                        Inspect Recipe
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="cr-pagination">
              <span className="cr-page-info">
                Page <strong>{recipePage}</strong> of{" "}
                <strong>{totalPages}</strong>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="cr-btn cr-btn-secondary cr-btn-sm"
                  disabled={recipePage <= 1}
                  onClick={() => setRecipePage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  type="button"
                  className="cr-btn cr-btn-secondary cr-btn-sm"
                  disabled={recipePage >= totalPages}
                  onClick={() =>
                    setRecipePage((p) => Math.min(totalPages, p + 1))
                  }
                >
                  Next
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Recipe Inspection Modal */}
      {selectedRecipe && (
        <div
          className="cr-modal-backdrop"
          onClick={() => setSelectedRecipe(null)}
        >
          <div
            className="cr-modal-card wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cr-modal-header">
              <h3>{selectedRecipe.name}</h3>
              <button
                type="button"
                className="cr-modal-close"
                onClick={() => setSelectedRecipe(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="cr-modal-body">
              {selectedRecipe.image_url && (
                <div
                  style={{
                    width: "100%",
                    height: 220,
                    borderRadius: 11,
                    overflow: "hidden",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <img
                    src={selectedRecipe.image_url}
                    alt={selectedRecipe.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}

              <div className="cr-review-grid">
                <div className="cr-info-block">
                  <span className="cr-info-label">Cooking Times & Servings</span>
                  <div className="cr-info-value">
                    Prep: {selectedRecipe.duration || 0}m · Total:{" "}
                    {selectedRecipe.total_time || 0}m · Servings:{" "}
                    {selectedRecipe.servings || 1}
                  </div>
                </div>

                <div className="cr-info-block">
                  <span className="cr-info-label">Nutrition Facts</span>
                  <div className="cr-info-value">
                    {selectedRecipe.nutritional_value
                      ? `${selectedRecipe.nutritional_value.calories || 0} kcal · P: ${
                          selectedRecipe.nutritional_value.protein || 0
                        }g · C: ${
                          selectedRecipe.nutritional_value.carbs || 0
                        }g · F: ${selectedRecipe.nutritional_value.fat || 0}g`
                      : "Not specified"}
                  </div>
                </div>
              </div>

              <div className="cr-info-block">
                <span className="cr-info-label">Ingredients</span>
                {Array.isArray(selectedRecipe.ingredients) &&
                selectedRecipe.ingredients.length > 0 ? (
                  <ul
                    style={{
                      margin: "6px 0 0 0",
                      paddingLeft: 18,
                      fontSize: "0.85rem",
                      color: "#334155",
                    }}
                  >
                    {selectedRecipe.ingredients.map((ing, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>
                        <strong>{ing.name}</strong> — {ing.quantity} {ing.unit}{" "}
                        {ing.No_of_servings
                          ? `(${ing.No_of_servings} servings)`
                          : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="cr-info-value">No ingredients listed</div>
                )}
              </div>

              <div className="cr-info-block">
                <span className="cr-info-label">Preparation Steps</span>
                {Array.isArray(selectedRecipe.steps) &&
                selectedRecipe.steps.length > 0 ? (
                  <ol
                    style={{
                      margin: "6px 0 0 0",
                      paddingLeft: 18,
                      fontSize: "0.85rem",
                      color: "#334155",
                    }}
                  >
                    {selectedRecipe.steps.map((step, idx) => (
                      <li key={idx} style={{ marginBottom: 6 }}>
                        {step.description}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="cr-info-value">No steps listed</div>
                )}
              </div>
            </div>

            <div className="cr-modal-footer">
              <button
                type="button"
                className="cr-btn cr-btn-secondary"
                onClick={() => setSelectedRecipe(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ban / Unban Creator Modal */}
      {banModalOpen && creator && (
        <div
          className="cr-modal-backdrop"
          onClick={() => !banLoading && setBanModalOpen(false)}
        >
          <div
            className="cr-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cr-modal-header">
              <h3>
                {creator.is_banned
                  ? `Unban ${creator.creator_name}`
                  : `Ban ${creator.creator_name}`}
              </h3>
              <button
                type="button"
                className="cr-modal-close"
                onClick={() => setBanModalOpen(false)}
                disabled={banLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="cr-modal-body">
              {creator.is_banned ? (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>
                  Are you sure you want to unban{" "}
                  <strong>{creator.creator_name}</strong>?
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: "#475569" }}>
                    Select or write a reason for banning{" "}
                    <strong>{creator.creator_name}</strong>:
                  </p>
                  <div className="cr-reason-pills">
                    {BAN_REASON_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="cr-reason-pill"
                        onClick={() => setBanReason(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="cr-textarea"
                    placeholder="Enter reason for banning this creator..."
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                  />
                </>
              )}
            </div>

            <div className="cr-modal-footer">
              <button
                type="button"
                className="cr-btn cr-btn-secondary"
                onClick={() => setBanModalOpen(false)}
                disabled={banLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`cr-btn ${
                  creator.is_banned ? "cr-btn-primary" : "cr-btn-danger"
                }`}
                onClick={handleToggleBan}
                disabled={banLoading}
              >
                {banLoading
                  ? "Processing..."
                  : creator.is_banned
                  ? "Confirm Unban"
                  : "Ban Creator"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
