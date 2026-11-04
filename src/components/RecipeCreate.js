// src/components/RecipeCreate.js
import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Image as ImageIcon,
  Upload,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  X,
} from "lucide-react";
import { axiosInstance } from "../api";
import CloudinaryService from "./cloudinaryService";
import {
  normalizeFoodImage,
  deduplicateGalleryItems,
} from "../pages/Imagelibrary";
import "./RecipeCreate.css";

const CATEGORIES_URL = "https://api.cookeaze.app/api/categories/";
const RECIPES_URL = "https://api.cookeaze.app/api/recipes/";
const FOOD_IMAGES_URL = "https://api.cookeaze.app/api/food-images/";
const IMAGES_CACHE_KEY = "cookeaze_food_images_catalog_v3";

const COMMON_UNITS = [
  "g",
  "kg",
  "ml",
  "L",
  "tbsp",
  "tsp",
  "cup",
  "pcs",
  "oz",
  "lb",
  "clove",
  "pinch",
];

const INITIAL_FORM = {
  name: "",
  categories_id: [],
  image_url: "",
  time_taken: "",
  total_time: "",
  servings: "",
  is_special: false,
  nutrition: {
    calories: "",
    fat: "",
    carbs: "",
    protein: "",
  },
  ingredients: [{ name: "", unit: "", quantity: "" }],
  steps: [{ step_number: 1, instruction: "", process_type: "prep" }],
};

function getCategoryLabel(cat) {
  if (!cat) return "";
  return String(cat.category_name || cat.name || cat.title || "").trim();
}

function extractCategories(resData) {
  if (!resData) return [];
  const root = resData.data !== undefined ? resData.data : resData;
  if (Array.isArray(root)) return root;
  if (Array.isArray(root?.results)) return root.results;
  return [];
}

function extractFoodImagesPage(resData) {
  if (!resData) return { results: [], count: 0 };
  const root = resData.data !== undefined ? resData.data : resData;
  if (Array.isArray(root)) {
    return { results: root, count: root.length };
  }
  const results = Array.isArray(root?.results)
    ? root.results
    : Array.isArray(root?.images)
    ? root.images
    : Array.isArray(resData?.results)
    ? resData.results
    : [];
  const count =
    typeof root?.count === "number"
      ? root.count
      : typeof resData?.count === "number"
      ? resData.count
      : results.length;
  return { results, count };
}

function getCachedFoodImages() {
  try {
    const raw = sessionStorage.getItem(IMAGES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
      return parsed.items;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

export default function RecipeCreate() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(INITIAL_FORM);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  // Image Upload & Library Picker States
  const [uploadingImage, setUploadingImage] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState([]);
  const [libraryCount, setLibraryCount] = useState(0);
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");

  // Submission & Feedback
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState(null);

  const showBanner = useCallback((text, type = "success") => {
    setBanner({ text, type });
  }, []);

  // Load Categories
  const fetchCategories = useCallback(async () => {
    try {
      setCategoriesLoading(true);
      const res = await axiosInstance.get(CATEGORIES_URL);
      const list = extractCategories(res.data);
      const seen = new Set();
      const deduped = [];
      for (let i = 0; i < list.length; i += 1) {
        const c = list[i];
        const label = getCategoryLabel(c);
        if (c && c.id && label && !seen.has(String(c.id))) {
          seen.add(String(c.id));
          deduped.push({ ...c, displayName: label });
        }
      }
      setCategories(deduped);
    } catch (err) {
      console.error("Error loading categories:", err);
      showBanner("Could not load categories.", "error");
    } finally {
      setCategoriesLoading(false);
    }
  }, [showBanner]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const handleRecover = () => fetchCategories();
    window.addEventListener("online", handleRecover);
    window.addEventListener("cookeaze:token-updated", handleRecover);
    return () => {
      window.removeEventListener("online", handleRecover);
      window.removeEventListener("cookeaze:token-updated", handleRecover);
    };
  }, [fetchCategories]);

  // Basic Input Handler
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => {
      const updated = {
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      };
      if (name === "time_taken" && !prev.total_time) {
        updated.total_time = value;
      }
      return updated;
    });
  };

  // Category Toggle
  const toggleCategory = (catId) => {
    const numId = Number(catId);
    setForm((prev) => {
      const exists = prev.categories_id.includes(numId);
      return {
        ...prev,
        categories_id: exists
          ? prev.categories_id.filter((id) => id !== numId)
          : [...prev.categories_id, numId],
      };
    });
  };

  // Nutrition Input Handler
  const handleNutritionChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      nutrition: {
        ...prev.nutrition,
        [name]: value,
      },
    }));
  };

  // Ingredient Handlers
  const handleIngredientChange = (index, field, value) => {
    setForm((prev) => {
      const updated = prev.ingredients.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      );
      return { ...prev, ingredients: updated };
    });
  };

  const addIngredient = () => {
    setForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: "", unit: "", quantity: "" }],
    }));
  };

  const removeIngredient = (index) => {
    setForm((prev) => {
      if (prev.ingredients.length <= 1) {
        return {
          ...prev,
          ingredients: [{ name: "", unit: "", quantity: "" }],
        };
      }
      return {
        ...prev,
        ingredients: prev.ingredients.filter((_, idx) => idx !== index),
      };
    });
  };

  // Step Handlers
  const renumberSteps = (stepsList) =>
    stepsList.map((step, i) => ({
      ...step,
      step_number: i + 1,
    }));

  const handleStepChange = (index, field, value) => {
    setForm((prev) => {
      const updated = prev.steps.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      );
      return { ...prev, steps: updated };
    });
  };

  const addStep = () => {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        {
          step_number: prev.steps.length + 1,
          instruction: "",
          process_type: "cook",
        },
      ],
    }));
  };

  const removeStep = (index) => {
    setForm((prev) => {
      if (prev.steps.length <= 1) {
        return {
          ...prev,
          steps: [{ step_number: 1, instruction: "", process_type: "prep" }],
        };
      }
      const filtered = prev.steps.filter((_, idx) => idx !== index);
      return { ...prev, steps: renumberSteps(filtered) };
    });
  };

  // Cloudinary Upload Handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setBanner(null);

    try {
      const uploadedUrl = await CloudinaryService.uploadFile(file, {
        folder: "cookeaze_recipes",
      });
      setForm((prev) => ({ ...prev, image_url: uploadedUrl }));
      showBanner("Image uploaded.");
    } catch (err) {
      console.error("Image upload error:", err);
      showBanner("Failed to upload image.", "error");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  // Fetch Image Library with deduplication, search, and pagination
  const fetchLibraryPage = useCallback(async (page = 1, query = "") => {
    const q = query.trim().toLowerCase();
    setLibraryLoading(true);

    try {
      // 1. Check if full catalog is cached in sessionStorage for instant filtering
      const cached = getCachedFoodImages();
      if (cached.length > 0) {
        const filtered = q
          ? cached.filter((item) => {
              const matchName = String(item.name || "")
                .toLowerCase()
                .includes(q);
              const matchId = String(item.id || "")
                .toLowerCase()
                .includes(q);
              const matchTag = (item.tags || []).some((t) =>
                String(t).toLowerCase().includes(q)
              );
              const matchSyn = (item.synonyms || []).some((s) =>
                String(s).toLowerCase().includes(q)
              );
              return matchName || matchId || matchTag || matchSyn;
            })
          : cached;

        const pageSize = 20;
        const start = (page - 1) * pageSize;
        setLibraryImages(filtered.slice(start, start + pageSize));
        setLibraryCount(filtered.length);
        setLibraryLoading(false);
        return;
      }

      // 2. Otherwise query the live API
      let res;
      if (q) {
        try {
          res = await axiosInstance.get(`${FOOD_IMAGES_URL}search/`, {
            params: { q: query.trim(), search: query.trim(), page },
          });
        } catch {
          res = await axiosInstance.get(FOOD_IMAGES_URL, {
            params: { search: query.trim(), page },
          });
        }
      } else {
        res = await axiosInstance.get(FOOD_IMAGES_URL, {
          params: { page },
        });
      }

      const { results, count } = extractFoodImagesPage(res.data);
      const normalized = results
        .map((r) => normalizeFoodImage(r))
        .filter((item) => item && item.url);
      const { uniqueItems } = deduplicateGalleryItems(normalized);

      setLibraryImages(uniqueItems);
      setLibraryCount(count || uniqueItems.length);
    } catch (err) {
      console.error("Failed to load image library:", err);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!libraryOpen) return undefined;
    const t = setTimeout(() => {
      fetchLibraryPage(libraryPage, librarySearch);
    }, 200);
    return () => clearTimeout(t);
  }, [libraryOpen, libraryPage, librarySearch, fetchLibraryPage]);

  const openImageLibrary = () => {
    setLibrarySearch("");
    setLibraryPage(1);
    setLibraryOpen(true);
  };

  const validIngredients = useMemo(
    () =>
      form.ingredients.filter(
        (i) =>
          String(i.name || "").trim() &&
          String(i.unit || "").trim() &&
          Number(i.quantity) > 0
      ),
    [form.ingredients]
  );

  const validSteps = useMemo(
    () => form.steps.filter((s) => String(s.instruction || "").trim()),
    [form.steps]
  );

  const selectedCategoryNames = useMemo(
    () =>
      categories
        .filter((c) => form.categories_id.includes(Number(c.id)))
        .map((c) => c.displayName),
    [categories, form.categories_id]
  );

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setBanner(null);
  };

  // Submit Recipe
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBanner(null);

    if (!form.name.trim()) {
      showBanner("Please enter a recipe name.", "error");
      return;
    }
    if (!form.image_url.trim()) {
      showBanner("Please upload or choose a cover image.", "error");
      return;
    }
    if (form.categories_id.length === 0) {
      showBanner("Please select at least one category.", "error");
      return;
    }
    if (
      Number(form.time_taken) <= 0 ||
      Number(form.total_time) <= 0 ||
      Number(form.servings) <= 0
    ) {
      showBanner(
        "Please enter valid Prep Time, Total Time, and Servings.",
        "error"
      );
      return;
    }
    if (validIngredients.length === 0) {
      showBanner("Please add at least one complete ingredient.", "error");
      return;
    }
    if (validSteps.length === 0) {
      showBanner("Please add at least one cooking step.", "error");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: form.name.trim(),
      categories_id: form.categories_id.map(Number),
      image_url: form.image_url.trim(),
      time_taken: Number(form.time_taken),
      total_time: Number(form.total_time),
      servings: Number(form.servings),
      is_special: Boolean(form.is_special),
      nutrition: {
        calories: Number(form.nutrition.calories) || 0,
        fat: Number(form.nutrition.fat) || 0,
        carbs: Number(form.nutrition.carbs) || 0,
        protein: Number(form.nutrition.protein) || 0,
      },
      ingredients: validIngredients.map((i) => ({
        name: i.name.trim(),
        unit: i.unit.trim(),
        quantity: Number(i.quantity),
      })),
      steps: validSteps.map((s, idx) => ({
        step_number: idx + 1,
        instruction: s.instruction.trim(),
        process_type: s.process_type || "prep",
      })),
    };

    try {
      await axiosInstance.post(RECIPES_URL, payload);
      showBanner(`Recipe "${payload.name}" created successfully!`, "success");
      setForm(INITIAL_FORM);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error("Create recipe error:", err);
      const apiErr =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Failed to create recipe. Please check all fields.";
      showBanner(String(apiErr), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const totalLibraryPages = Math.max(1, Math.ceil(libraryCount / 20));

  return (
    <div className="rcreate-page">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <div className="rcreate-container">
        {/* Clean Header */}
        <header className="rcreate-header">
          <div className="rcreate-header-left">
            <button
              type="button"
              className="rcreate-back-btn"
              onClick={() => navigate("/recipe")}
            >
              <ArrowLeft size={15} />
              Back
            </button>
            <h1 className="rcreate-title">Create Recipe</h1>
          </div>

          <div className="rcreate-header-actions">
            <button
              type="button"
              className="rcreate-btn"
              onClick={handleReset}
              disabled={submitting}
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              type="button"
              className="rcreate-btn rcreate-btn--primary"
              onClick={handleSubmit}
              disabled={submitting || uploadingImage}
            >
              {submitting ? "Saving..." : "Create Recipe"}
            </button>
          </div>
        </header>

        {/* Alert Banner */}
        {banner && (
          <div
            role="alert"
            className={`rcreate-alert ${
              banner.type === "error"
                ? "rcreate-alert--error"
                : "rcreate-alert--success"
            }`}
          >
            <span>{banner.text}</span>
            <button
              type="button"
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
              onClick={() => setBanner(null)}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* 2-Column Workspace: Clean Form + Sticky Side Preview */}
        <form onSubmit={handleSubmit} className="rcreate-workspace" noValidate>
          <div className="rcreate-form">
            {/* 1. Basic Details & Cover Image */}
            <section className="rcreate-section">
              <div className="rcreate-section-head">
                <h2 className="rcreate-section-title">Basic Details</h2>
              </div>

              <div>
                <label htmlFor="rc-name" className="rcreate-label">
                  Recipe Name
                </label>
                <input
                  id="rc-name"
                  type="text"
                  name="name"
                  className="rcreate-input"
                  placeholder="Enter recipe name"
                  value={form.name}
                  onChange={handleChange}
                />
              </div>

              <div className="rcreate-row-3">
                <div>
                  <label htmlFor="rc-time-taken" className="rcreate-label">
                    Prep Time (mins)
                  </label>
                  <input
                    id="rc-time-taken"
                    type="number"
                    min="1"
                    name="time_taken"
                    className="rcreate-input"
                    placeholder="25"
                    value={form.time_taken}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="rc-total-time" className="rcreate-label">
                    Total Time (mins)
                  </label>
                  <input
                    id="rc-total-time"
                    type="number"
                    min="1"
                    name="total_time"
                    className="rcreate-input"
                    placeholder="45"
                    value={form.total_time}
                    onChange={handleChange}
                  />
                </div>

                <div>
                  <label htmlFor="rc-servings" className="rcreate-label">
                    Servings
                  </label>
                  <input
                    id="rc-servings"
                    type="number"
                    min="1"
                    name="servings"
                    className="rcreate-input"
                    placeholder="4"
                    value={form.servings}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Cover Image */}
              <div className="rcreate-cover-row">
                <div
                  className="rcreate-cover-thumb"
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to upload cover image"
                >
                  {form.image_url ? (
                    <img src={form.image_url} alt="Cover" />
                  ) : (
                    <ImageIcon size={22} />
                  )}
                </div>

                <div className="rcreate-cover-controls">
                  <label htmlFor="rc-image-url" className="rcreate-label">
                    Cover Image
                  </label>
                  <input
                    id="rc-image-url"
                    type="url"
                    name="image_url"
                    className="rcreate-input"
                    placeholder="Paste image URL or upload below"
                    value={form.image_url}
                    onChange={handleChange}
                  />
                  <div className="rcreate-cover-actions">
                    <button
                      type="button"
                      className="rcreate-btn rcreate-btn--soft rcreate-btn--sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      <Upload size={13} />
                      {uploadingImage ? "Uploading..." : "Upload Image"}
                    </button>

                    <button
                      type="button"
                      className="rcreate-btn rcreate-btn--sm"
                      onClick={openImageLibrary}
                    >
                      <ImageIcon size={13} />
                      Choose from Library
                    </button>
                  </div>
                </div>
              </div>

              <label htmlFor="rc-is-special" className="rcreate-special-row">
                <input
                  id="rc-is-special"
                  type="checkbox"
                  name="is_special"
                  checked={form.is_special}
                  onChange={handleChange}
                  style={{ width: 16, height: 16, accentColor: "#129575" }}
                />
                <span>Mark as Special / Featured Recipe</span>
              </label>
            </section>

            {/* 2. Categories */}
            <section className="rcreate-section">
              <div className="rcreate-section-head">
                <h2 className="rcreate-section-title">Categories</h2>
                {form.categories_id.length > 0 && (
                  <span className="rcreate-badge">
                    {form.categories_id.length} selected
                  </span>
                )}
              </div>

              {categoriesLoading ? (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  Loading categories...
                </div>
              ) : categories.length === 0 ? (
                <div style={{ fontSize: 13, color: "#94a3b8" }}>
                  No categories available.
                </div>
              ) : (
                <div className="rcreate-cat-grid">
                  {categories.map((cat) => {
                    const isSelected = form.categories_id.includes(
                      Number(cat.id)
                    );
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        className={`rcreate-cat-pill${
                          isSelected ? " rcreate-cat-pill--active" : ""
                        }`}
                        onClick={() => toggleCategory(cat.id)}
                      >
                        {isSelected && <Check size={13} />}
                        <span>{cat.displayName}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* 3. Ingredients */}
            <section className="rcreate-section">
              <div className="rcreate-section-head">
                <h2 className="rcreate-section-title">Ingredients</h2>
                <button
                  type="button"
                  className="rcreate-btn rcreate-btn--soft rcreate-btn--sm"
                  onClick={addIngredient}
                >
                  <Plus size={14} />
                  Add Ingredient
                </button>
              </div>

              <div className="rcreate-ing-cols">
                <span />
                <span>Name</span>
                <span>Quantity</span>
                <span>Unit</span>
                <span />
              </div>

              {form.ingredients.map((ing, index) => (
                <div key={index} className="rcreate-ing-item">
                  <span className="rcreate-row-num">{index + 1}.</span>

                  <input
                    type="text"
                    className="rcreate-input"
                    placeholder="Ingredient name"
                    value={ing.name}
                    onChange={(e) =>
                      handleIngredientChange(index, "name", e.target.value)
                    }
                  />

                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="rcreate-input"
                    placeholder="0"
                    value={ing.quantity}
                    onChange={(e) =>
                      handleIngredientChange(index, "quantity", e.target.value)
                    }
                  />

                  <input
                    type="text"
                    list="rcreate-unit-list"
                    className="rcreate-input"
                    placeholder="g, cup, tbsp"
                    value={ing.unit}
                    onChange={(e) =>
                      handleIngredientChange(index, "unit", e.target.value)
                    }
                  />

                  <button
                    type="button"
                    className="rcreate-btn--icon-remove"
                    title="Remove ingredient"
                    onClick={() => removeIngredient(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}

              <datalist id="rcreate-unit-list">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </section>

            {/* 4. Cooking Steps */}
            <section className="rcreate-section">
              <div className="rcreate-section-head">
                <h2 className="rcreate-section-title">Cooking Steps</h2>
                <button
                  type="button"
                  className="rcreate-btn rcreate-btn--soft rcreate-btn--sm"
                  onClick={addStep}
                >
                  <Plus size={14} />
                  Add Step
                </button>
              </div>

              {form.steps.map((step, index) => (
                <div key={index} className="rcreate-step-item">
                  <span className="rcreate-step-num">{index + 1}</span>

                  <textarea
                    className="rcreate-textarea"
                    placeholder={`Step ${index + 1} instructions`}
                    value={step.instruction}
                    onChange={(e) =>
                      handleStepChange(index, "instruction", e.target.value)
                    }
                  />

                  <select
                    className="rcreate-select"
                    value={step.process_type}
                    onChange={(e) =>
                      handleStepChange(index, "process_type", e.target.value)
                    }
                  >
                    <option value="prep">Prep</option>
                    <option value="cook">Cook</option>
                    <option value="finish">Finish</option>
                  </select>

                  <button
                    type="button"
                    className="rcreate-btn--icon-remove"
                    style={{ marginTop: 4 }}
                    title="Remove step"
                    onClick={() => removeStep(index)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </section>

            {/* 5. Nutrition (Per Serving) */}
            <section className="rcreate-section">
              <div className="rcreate-section-head">
                <h2 className="rcreate-section-title">Nutrition (Per Serving)</h2>
              </div>

              <div className="rcreate-row-4">
                {[
                  { key: "calories", label: "Calories (kcal)" },
                  { key: "protein", label: "Protein (g)" },
                  { key: "carbs", label: "Carbs (g)" },
                  { key: "fat", label: "Fat (g)" },
                ].map((macro) => (
                  <div key={macro.key}>
                    <label
                      htmlFor={`rc-macro-${macro.key}`}
                      className="rcreate-label"
                    >
                      {macro.label}
                    </label>
                    <input
                      id={`rc-macro-${macro.key}`}
                      type="number"
                      step="any"
                      min="0"
                      name={macro.key}
                      className="rcreate-input"
                      placeholder="0"
                      value={form.nutrition[macro.key]}
                      onChange={handleNutritionChange}
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* RIGHT SIDE: Sticky Live Recipe Preview */}
          <aside className="rcreate-side">
            <div className="rcreate-preview-card">
              <div className="rcreate-preview-head">
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>
                  Recipe Preview
                </span>
                <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                  Live Card
                </span>
              </div>

              <div className="rcreate-preview-media">
                {form.image_url ? (
                  <img src={form.image_url} alt="Recipe preview" />
                ) : (
                  <span>Cover image preview</span>
                )}
                {form.is_special && (
                  <span className="rcreate-preview-special">Featured</span>
                )}
              </div>

              <div className="rcreate-preview-body">
                <h3 className="rcreate-preview-title">
                  {form.name.trim() || "Untitled Recipe"}
                </h3>

                <div className="rcreate-preview-meta">
                  <span>{form.total_time || form.time_taken || 0} mins</span>
                  <span>•</span>
                  <span>{form.servings || 1} servings</span>
                  <span>•</span>
                  <span>{form.nutrition.calories || 0} kcal</span>
                </div>

                {selectedCategoryNames.length > 0 && (
                  <div className="rcreate-preview-cats">
                    {selectedCategoryNames.map((name) => (
                      <span key={name} className="rcreate-preview-cat">
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="rcreate-preview-stats">
                  <div>
                    <div className="rcreate-preview-stat-val">
                      {validIngredients.length}
                    </div>
                    <div className="rcreate-preview-stat-lbl">Ingredients</div>
                  </div>
                  <div>
                    <div className="rcreate-preview-stat-val">
                      {validSteps.length}
                    </div>
                    <div className="rcreate-preview-stat-lbl">Steps</div>
                  </div>
                  <div>
                    <div className="rcreate-preview-stat-val">
                      {form.nutrition.protein || 0}g
                    </div>
                    <div className="rcreate-preview-stat-lbl">Protein</div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="rcreate-btn rcreate-btn--primary"
                  style={{ width: "100%", marginTop: 18, padding: "11px 16px" }}
                  disabled={submitting || uploadingImage}
                >
                  {submitting ? "Saving..." : "Create Recipe"}
                </button>
              </div>
            </div>
          </aside>
        </form>
      </div>

      {/* IMAGE LIBRARY PICKER MODAL (Deduplicated, Paginated & Tag-Searchable) */}
      {libraryOpen && (
        <div
          className="rcreate-modal-backdrop"
          onClick={() => setLibraryOpen(false)}
        >
          <div className="rcreate-modal" onClick={(e) => e.stopPropagation()}>
            <div className="rcreate-modal-head">
              <div>
                <h3 className="rcreate-section-title">
                  Choose from Image Library
                </h3>
                <span style={{ fontSize: 12, color: "#64748b" }}>
                  Click any image to use it as your recipe cover
                </span>
              </div>
              <button
                type="button"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                onClick={() => setLibraryOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="rcreate-modal-search">
              <input
                type="text"
                className="rcreate-input"
                placeholder="Search by food name, tag, or ID..."
                value={librarySearch}
                onChange={(e) => {
                  setLibrarySearch(e.target.value);
                  setLibraryPage(1);
                }}
              />
              {librarySearch && (
                <button
                  type="button"
                  className="rcreate-btn rcreate-btn--sm"
                  onClick={() => {
                    setLibrarySearch("");
                    setLibraryPage(1);
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            {libraryLoading ? (
              <div
                style={{
                  padding: "48px 18px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                  flex: 1,
                }}
              >
                Loading images...
              </div>
            ) : libraryImages.length === 0 ? (
              <div
                style={{
                  padding: "48px 18px",
                  textAlign: "center",
                  color: "#94a3b8",
                  fontSize: 13,
                  flex: 1,
                }}
              >
                No matching images found.
              </div>
            ) : (
              <div className="rcreate-lib-grid">
                {libraryImages.map((img) => {
                  const isSelected = form.image_url === img.url;
                  const tagText =
                    Array.isArray(img.tags) && img.tags.length > 0
                      ? img.tags.slice(0, 3).join(", ")
                      : "";
                  return (
                    <button
                      key={img.id}
                      type="button"
                      className={`rcreate-lib-item${
                        isSelected ? " rcreate-lib-item--selected" : ""
                      }`}
                      onClick={() => {
                        setForm((prev) => ({ ...prev, image_url: img.url }));
                        setLibraryOpen(false);
                      }}
                    >
                      <img
                        src={img.thumb || img.url}
                        alt={img.name}
                        loading="lazy"
                      />
                      <div className="rcreate-lib-meta">
                        <div className="rcreate-lib-title">{img.name}</div>
                        {tagText && (
                          <div className="rcreate-lib-tags">{tagText}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="rcreate-modal-foot">
              <span>
                Page {libraryPage} of {totalLibraryPages}
                {libraryCount > 0 ? ` (${libraryCount} images)` : ""}
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="rcreate-btn rcreate-btn--sm"
                  disabled={libraryPage <= 1 || libraryLoading}
                  onClick={() => setLibraryPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="rcreate-btn rcreate-btn--sm"
                  disabled={libraryPage >= totalLibraryPages || libraryLoading}
                  onClick={() =>
                    setLibraryPage((p) => Math.min(totalLibraryPages, p + 1))
                  }
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
