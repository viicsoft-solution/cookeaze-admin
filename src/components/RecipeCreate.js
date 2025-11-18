"use client";

// Modern, clean design with better visual hierarchy and improved user experience

import { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://api.cookeaze.app/api/recipes/";

const emptyIngredient = () => ({ name: "", quantity: "", unit: "" });
const emptyStep = (num) => ({
  step_number: num,
  description: "",
  duration: 0,
  step_type: "prep",
});

export default function RecipeCreate() {
  const [name, setName] = useState("");
  const [categoriesText, setCategoriesText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [totalTime, setTotalTime] = useState(30);
  const [servings, setServings] = useState(2);
  const [isExclusive, setIsExclusive] = useState(false);
  const [calories, setCalories] = useState("");
  const [country, setCountry] = useState("");
  const [price, setPrice] = useState("");
  const [ingredients, setIngredients] = useState([emptyIngredient()]);
  const [steps, setSteps] = useState([emptyStep(1)]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const token = localStorage.getItem("token");

  const axiosInstance = axios.create({
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  const addIngredient = () => setIngredients((s) => [...s, emptyIngredient()]);
  const updateIngredient = (i, field, value) => {
    setIngredients((s) =>
      s.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing))
    );
  };
  const removeIngredient = (i) =>
    setIngredients((s) => s.filter((_, idx) => idx !== i));

  const addStep = () => setSteps((s) => [...s, emptyStep(s.length + 1)]);
  const updateStep = (i, field, value) => {
    setSteps((s) => {
      const next = s.map((st, idx) =>
        idx === i ? { ...st, [field]: value } : st
      );
      return next.map((st, idx) => ({ ...st, step_number: idx + 1 }));
    });
  };
  const removeStep = (i) => {
    setSteps((s) => {
      const next = s.filter((_, idx) => idx !== i);
      return next.map((st, idx) => ({ ...st, step_number: idx + 1 }));
    });
  };

  // Categories state
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");

  // Fetch categories on load
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axiosInstance.get(
          "https://api.cookeaze.app/api/categories/"
        );

        // Access the correct array inside `data`
        const catArray = res.data?.data || [];

        setCategories(catArray);
      } catch (err) {
        console.error("Failed to fetch categories:", err);
        setCategories([]); // fallback to empty array
      }
    };
    fetchCategories();
  }, []);

  const validate = () => {
    if (!name.trim()) {
      setStatus({ type: "danger", text: "Recipe name is required." });
      return false;
    }
    if (!imageUrl.trim()) {
      setStatus({
        type: "danger",
        text: "Image URL is required (public recipes require a valid image).",
      });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (!validate()) return;

    setSubmitting(true);

    const payload = {
      name: name.trim(),
      category: selectedCategory ? [Number(selectedCategory)] : [],

      image_url: imageUrl.trim(),
      description: description.trim(),
      total_time: Number(totalTime) || 0,
      servings: Number(servings) || 1,
      isExclusive: !!isExclusive,
      calories: calories.trim(),
      country: country.trim(),
      price: price.trim(),
      ingredients_data: ingredients
        .map((ing) => ({
          name: ing.name?.trim() || "",
          quantity: ing.quantity?.trim() || "",
          unit: ing.unit?.trim() || "",
        }))
        .filter((ing) => ing.name),
      steps_data: steps
        .map((st, idx) => ({
          step_number: Number(st.step_number || idx + 1),
          description: st.description?.trim() || "",
          duration: Number(st.duration || 0),
          step_type: st.step_type || "prep",
        }))
        .filter((s) => s.description),
    };

    try {
      const res = await axiosInstance.post(API_BASE, payload);
      setStatus({ type: "success", text: "Recipe created successfully." });
      setName("");
      setCategoriesText("");
      setImageUrl("");
      setDescription("");
      setTotalTime(30);
      setServings(2);
      setIsExclusive(false);
      setCalories("");
      setCountry("");
      setPrice("");
      setIngredients([emptyIngredient()]);
      setSteps([emptyStep(1)]);
    } catch (err) {
      console.error("Create failed:", err);
      const serverMsg =
        err?.response?.data?.message || err?.response?.data || err.message;
      setStatus({
        type: "danger",
        text: `Failed to create recipe. ${serverMsg}`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const previewCategories = categoriesText
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  const styles = {
    container: {
      maxWidth: "1400px",
      margin: "0 auto",
      padding: "40px 20px",
      backgroundColor: "#f9f7f4",
      minHeight: "100vh",
      fontFamily: "'Geist', sans-serif",
    },
    header: {
      marginBottom: "40px",
    },
    title: {
      fontSize: "32px",
      fontWeight: "700",
      color: "#1a1a1a",
      margin: "0 0 8px 0",
    },
    subtitle: {
      fontSize: "14px",
      color: "#666",
      margin: "0",
    },
    wrapper: {
      display: "grid",
      gridTemplateColumns: "1fr 420px",
      gap: "30px",
      alignItems: "start",
    },
    card: {
      backgroundColor: "#fff",
      borderRadius: "12px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
      padding: "32px",
    },
    statusAlert: {
      padding: "16px",
      borderRadius: "8px",
      marginBottom: "24px",
      fontSize: "14px",
      fontWeight: "500",
      border: "1px solid",
    },
    successAlert: {
      backgroundColor: "#ecfdf5",
      borderColor: "#86efac",
      color: "#166534",
    },
    errorAlert: {
      backgroundColor: "#fef2f2",
      borderColor: "#fca5a5",
      color: "#991b1b",
    },
    section: {
      marginBottom: "32px",
    },
    sectionTitle: {
      fontSize: "14px",
      fontWeight: "600",
      color: "#1a1a1a",
      marginBottom: "16px",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
    },
    formGroup: {
      marginBottom: "20px",
    },
    label: {
      fontSize: "14px",
      fontWeight: "500",
      color: "#333",
      marginBottom: "8px",
      display: "block",
    },
    required: {
      color: "#e74c3c",
    },
    input: {
      width: "100%",
      padding: "12px 14px",
      fontSize: "14px",
      border: "1px solid #e0dcd9",
      borderRadius: "8px",
      fontFamily: "inherit",
      transition: "all 0.2s ease",
      boxSizing: "border-box",
    },
    inputFocus: {
      borderColor: "#d4a574",
      outline: "none",
      boxShadow: "0 0 0 3px rgba(212, 165, 116, 0.1)",
    },
    textarea: {
      width: "100%",
      padding: "12px 14px",
      fontSize: "14px",
      border: "1px solid #e0dcd9",
      borderRadius: "8px",
      fontFamily: "inherit",
      resize: "vertical",
      minHeight: "100px",
      transition: "all 0.2s ease",
      boxSizing: "border-box",
    },
    formRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "16px",
    },
    button: {
      padding: "12px 20px",
      fontSize: "14px",
      fontWeight: "600",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      transition: "all 0.2s ease",
      fontFamily: "inherit",
    },
    primaryButton: {
      backgroundColor: "#d4a574",
      color: "#fff",
    },
    primaryButtonHover: {
      backgroundColor: "#c4945f",
      boxShadow: "0 4px 12px rgba(212, 165, 116, 0.3)",
    },
    secondaryButton: {
      backgroundColor: "#f0ebe5",
      color: "#333",
      border: "1px solid #e0dcd9",
    },
    secondaryButtonHover: {
      backgroundColor: "#e8e2d9",
    },
    smallButton: {
      padding: "8px 12px",
      fontSize: "13px",
    },
    dangerButton: {
      backgroundColor: "#ef4444",
      color: "#fff",
    },
    dangerButtonHover: {
      backgroundColor: "#dc2626",
    },
    buttonGroup: {
      display: "flex",
      gap: "12px",
      marginTop: "32px",
    },
    itemRow: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: "12px",
      padding: "16px",
      backgroundColor: "#fafaf8",
      borderRadius: "8px",
      marginBottom: "12px",
      border: "1px solid #e0dcd9",
    },
    itemInputRow: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
      gap: "12px",
      alignItems: "center",
    },
    ingredientsList: {
      display: "grid",
      gap: "8px",
    },
    stepNumber: {
      fontSize: "12px",
      fontWeight: "600",
      color: "#999",
      marginBottom: "8px",
      textTransform: "uppercase",
    },
    previewCard: {
      position: "sticky",
      top: "20px",
    },
    previewImage: {
      width: "100%",
      height: "200px",
      objectFit: "cover",
      borderRadius: "8px",
      backgroundColor: "#f0ebe5",
      marginBottom: "20px",
    },
    previewImagePlaceholder: {
      width: "100%",
      height: "200px",
      backgroundColor: "#f0ebe5",
      borderRadius: "8px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#999",
      marginBottom: "20px",
      fontSize: "14px",
    },
    previewTitle: {
      fontSize: "20px",
      fontWeight: "700",
      color: "#1a1a1a",
      marginBottom: "12px",
    },
    badge: {
      display: "inline-block",
      backgroundColor: "#d4a574",
      color: "#fff",
      padding: "6px 12px",
      borderRadius: "20px",
      fontSize: "12px",
      fontWeight: "600",
      marginRight: "6px",
      marginBottom: "12px",
    },
    previewMeta: {
      display: "flex",
      gap: "16px",
      fontSize: "13px",
      color: "#666",
      marginTop: "16px",
      paddingTop: "16px",
      borderTop: "1px solid #e0dcd9",
    },
    previewList: {
      fontSize: "13px",
      lineHeight: "1.8",
      color: "#333",
    },
    addButtonGroup: {
      display: "flex",
      justifyContent: "flex-end",
      marginBottom: "16px",
    },
    removeButtonContainer: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
    },
    checkboxContainer: {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "16px",
    },
    checkbox: {
      width: "18px",
      height: "18px",
      cursor: "pointer",
      accentColor: "#d4a574",
    },
    checkboxLabel: {
      fontSize: "14px",
      cursor: "pointer",
      color: "#333",
    },
    formHelper: {
      fontSize: "12px",
      color: "#999",
      marginTop: "6px",
    },
    spinnerContainer: {
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
    },
    spinner: {
      width: "16px",
      height: "16px",
      border: "2px solid rgba(255,255,255,0.3)",
      borderTop: "2px solid #fff",
      borderRadius: "50%",
      animation: "spin 0.6s linear infinite",
    },
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input:focus, textarea:focus, select:focus {
          outline: none;
          border-color: #d4a574;
          box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.1);
        }
      `}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Create Recipe</h1>
        <p style={styles.subtitle}>
          Share your culinary creation with the community
        </p>
      </div>

      <div style={styles.wrapper}>
        {/* Form Column */}
        <div>
          <div style={styles.card}>
            {status && (
              <div
                style={{
                  ...styles.statusAlert,
                  ...(status.type === "success"
                    ? styles.successAlert
                    : styles.errorAlert),
                }}
              >
                {status.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Basic Info */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Recipe Details</h3>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Recipe Name
                    <span style={styles.required}>*</span>
                  </label>
                  <input
                    style={styles.input}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Classic Beef Hamburger"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Description</label>
                  <textarea
                    style={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Share what makes this recipe special..."
                  />
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      Category
                      <span style={styles.required}>*</span>
                    </label>
                    <select
                      style={styles.input}
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="">Select Category</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.category_name}
                        </option>
                      ))}
                    </select>
                    <div style={styles.formHelper}>
                      Choose one category for this recipe
                    </div>
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>
                      Image URL
                      <span style={styles.required}>*</span>
                    </label>
                    <input
                      style={styles.input}
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="https://..."
                    />
                    <div style={styles.formHelper}>
                      High-quality images perform better
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipe Info */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Recipe Information</h3>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Total Time (min)</label>
                    <input
                      style={styles.input}
                      type="number"
                      min="0"
                      value={totalTime}
                      onChange={(e) => setTotalTime(e.target.value)}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Servings</label>
                    <input
                      style={styles.input}
                      type="number"
                      min="1"
                      value={servings}
                      onChange={(e) => setServings(e.target.value)}
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Calories</label>
                    <input
                      style={styles.input}
                      value={calories}
                      onChange={(e) => setCalories(e.target.value)}
                      placeholder="per serving"
                    />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Country</label>
                    <input
                      style={styles.input}
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Nigeria, France, etc."
                    />
                  </div>

                  <div style={styles.formGroup}>
                    <label style={styles.label}>Price</label>
                    <input
                      style={styles.input}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div style={styles.checkboxContainer}>
                  <input
                    style={styles.checkbox}
                    type="checkbox"
                    id="exclusiveCheck"
                    checked={isExclusive}
                    onChange={(e) => setIsExclusive(e.target.checked)}
                  />
                  <label style={styles.checkboxLabel} htmlFor="exclusiveCheck">
                    Mark as exclusive recipe
                  </label>
                </div>
              </div>

              {/* Ingredients */}
              <div style={styles.section}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3 style={{ ...styles.sectionTitle, margin: 0 }}>
                    Ingredients
                  </h3>
                  <button
                    type="button"
                    style={{
                      ...styles.button,
                      ...styles.smallButton,
                      backgroundColor: "#d4a574",
                      color: "#fff",
                    }}
                    onMouseEnter={(e) =>
                      (e.target.style.backgroundColor = "#c4945f")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.backgroundColor = "#d4a574")
                    }
                    onClick={addIngredient}
                  >
                    + Add
                  </button>
                </div>

                <div style={styles.ingredientsList}>
                  {ingredients.map((ing, idx) => (
                    <div key={idx} style={styles.itemRow}>
                      <div style={styles.itemInputRow}>
                        <input
                          style={styles.input}
                          placeholder="Ingredient name"
                          value={ing.name}
                          onChange={(e) =>
                            updateIngredient(idx, "name", e.target.value)
                          }
                        />
                        <input
                          style={styles.input}
                          placeholder="Qty"
                          value={ing.quantity}
                          onChange={(e) =>
                            updateIngredient(idx, "quantity", e.target.value)
                          }
                        />
                        <input
                          style={styles.input}
                          placeholder="Unit"
                          value={ing.unit}
                          onChange={(e) =>
                            updateIngredient(idx, "unit", e.target.value)
                          }
                        />
                        <button
                          type="button"
                          style={{
                            ...styles.button,
                            ...styles.smallButton,
                            ...styles.dangerButton,
                          }}
                          onMouseEnter={(e) =>
                            (e.target.style.backgroundColor = "#dc2626")
                          }
                          onMouseLeave={(e) =>
                            (e.target.style.backgroundColor = "#ef4444")
                          }
                          onClick={() => removeIngredient(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps */}
              <div style={styles.section}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "16px",
                  }}
                >
                  <h3 style={{ ...styles.sectionTitle, margin: 0 }}>Steps</h3>
                  <button
                    type="button"
                    style={{
                      ...styles.button,
                      ...styles.smallButton,
                      backgroundColor: "#d4a574",
                      color: "#fff",
                    }}
                    onMouseEnter={(e) =>
                      (e.target.style.backgroundColor = "#c4945f")
                    }
                    onMouseLeave={(e) =>
                      (e.target.style.backgroundColor = "#d4a574")
                    }
                    onClick={addStep}
                  >
                    + Add
                  </button>
                </div>

                <div>
                  {steps.map((st, idx) => (
                    <div key={idx} style={styles.itemRow}>
                      <div style={styles.stepNumber}>Step {idx + 1}</div>
                      <textarea
                        style={styles.textarea}
                        rows="2"
                        placeholder="Describe this step..."
                        value={st.description}
                        onChange={(e) =>
                          updateStep(idx, "description", e.target.value)
                        }
                      />
                      <div style={styles.itemInputRow}>
                        <input
                          style={styles.input}
                          type="number"
                          min="0"
                          placeholder="Duration (min)"
                          value={st.duration}
                          onChange={(e) =>
                            updateStep(idx, "duration", e.target.value)
                          }
                        />
                        <select
                          style={styles.input}
                          value={st.step_type}
                          onChange={(e) =>
                            updateStep(idx, "step_type", e.target.value)
                          }
                        >
                          <option value="prep">Prep</option>
                          <option value="cook">Cook</option>
                          <option value="finish">Finish</option>
                        </select>
                        <button
                          type="button"
                          style={{
                            ...styles.button,
                            ...styles.smallButton,
                            ...styles.dangerButton,
                          }}
                          onMouseEnter={(e) =>
                            (e.target.style.backgroundColor = "#dc2626")
                          }
                          onMouseLeave={(e) =>
                            (e.target.style.backgroundColor = "#ef4444")
                          }
                          onClick={() => removeStep(idx)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div style={styles.buttonGroup}>
                <button
                  type="submit"
                  style={{
                    ...styles.button,
                    ...styles.primaryButton,
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.backgroundColor = "#c4945f")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.backgroundColor = "#d4a574")
                  }
                  disabled={submitting}
                >
                  {submitting ? (
                    <span style={styles.spinnerContainer}>
                      <div style={styles.spinner} />
                      Creating...
                    </span>
                  ) : (
                    "Create Recipe"
                  )}
                </button>

                <button
                  type="button"
                  style={{
                    ...styles.button,
                    ...styles.secondaryButton,
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.backgroundColor = "#e8e2d9")
                  }
                  onMouseLeave={(e) =>
                    (e.target.style.backgroundColor = "#f0ebe5")
                  }
                  onClick={() => {
                    setName("");
                    setCategoriesText("");
                    setImageUrl("");
                    setDescription("");
                    setTotalTime(30);
                    setServings(2);
                    setIsExclusive(false);
                    setCalories("");
                    setCountry("");
                    setPrice("");
                    setIngredients([emptyIngredient()]);
                    setSteps([emptyStep(1)]);
                    setStatus(null);
                  }}
                >
                  Reset
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Preview Column */}
        <div style={styles.previewCard}>
          <div style={styles.card}>
            <h3 style={styles.sectionTitle}>Preview</h3>

            {imageUrl ? (
              <img
                src={imageUrl || "/placeholder.svg"}
                alt="recipe preview"
                style={styles.previewImage}
                onError={(e) => {
                  e.target.src =
                    "https://via.placeholder.com/400x300?text=Invalid+Image";
                }}
              />
            ) : (
              <div style={styles.previewImagePlaceholder}>No image yet</div>
            )}

            <div style={styles.previewTitle}>{name || "Recipe name"}</div>

            <div>
              {previewCategories.map((c, i) => (
                <span key={i} style={styles.badge}>
                  {c}
                </span>
              ))}
            </div>

            <p style={{ fontSize: "13px", color: "#666", lineHeight: "1.6" }}>
              {description || "Your description will appear here."}
            </p>

            <div style={styles.previewMeta}>
              <div>⏱ {totalTime}m</div>
              <div>🍽 {servings} servings</div>
              <div>{isExclusive ? "🔒 Exclusive" : "📖 Public"}</div>
            </div>

            <hr
              style={{
                border: "none",
                borderTop: "1px solid #e0dcd9",
                margin: "16px 0",
              }}
            />

            <div style={styles.section}>
              <h4 style={{ ...styles.sectionTitle, fontSize: "12px" }}>
                Ingredients
              </h4>
              <ul style={{ ...styles.previewList, paddingLeft: "20px" }}>
                {ingredients.filter((i) => i.name).length ? (
                  ingredients
                    .filter((i) => i.name)
                    .map((ing, idx) => (
                      <li key={idx}>
                        {ing.quantity ? `${ing.quantity} ${ing.unit} ` : ""}
                        <strong>{ing.name}</strong>
                      </li>
                    ))
                ) : (
                  <li style={{ color: "#999" }}>No ingredients yet</li>
                )}
              </ul>
            </div>

            <div>
              <h4 style={{ ...styles.sectionTitle, fontSize: "12px" }}>
                Steps
              </h4>
              <ol style={{ ...styles.previewList, paddingLeft: "20px" }}>
                {steps.filter((s) => s.description).length ? (
                  steps
                    .filter((s) => s.description)
                    .map((s, idx) => (
                      <li key={idx} style={{ marginBottom: "8px" }}>
                        <div>{s.description}</div>
                        <div style={{ fontSize: "11px", color: "#999" }}>
                          ({s.step_type} • {s.duration}m)
                        </div>
                      </li>
                    ))
                ) : (
                  <li style={{ color: "#999" }}>No steps yet</li>
                )}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
