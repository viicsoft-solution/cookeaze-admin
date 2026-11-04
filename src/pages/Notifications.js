import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Send,
} from "lucide-react";
import { axiosInstance, ensureValidToken } from "../api";
import { useAuth } from "../contexts/AuthProvider";
import CloudinaryService from "../components/cloudinaryService";
import "./Notifications.css";

const API_BASE = "https://api.cookeaze.app/api";
const HISTORY_STORAGE_KEY = "cookeaze_notification_history_v1";
const RECIPES_CACHE_KEY = "cookeaze_recipes_catalog_v4";

const BROADCAST_PRESETS = [
  {
    label: "Weekend Specials",
    title: "Fresh Weekend Recipes Are Here!",
    body: "Explore hand-picked chef specials and step-by-step meal guides for your weekend table.",
  },
  {
    label: "Weekly Meal Plan",
    title: "Plan Your Week with Cookeaze",
    body: "Save time and eat better this week—discover quick 30-minute recipes curated for you.",
  },
  {
    label: "Ask SousChef",
    title: "Have Ingredients in Your Fridge?",
    body: "Open Cookeaze and let SousChef craft a custom step-by-step recipe in seconds.",
  },
];

const MEAL_PRESETS = {
  breakfast: {
    title: "Good Morning! What's for Breakfast?",
    body: "Start your day right with quick, energizing breakfast ideas ready in under 20 minutes.",
  },
  lunch: {
    title: "Lunchtime Inspiration Awaits",
    body: "Take a break and whip up a fresh, flavorful lunch from your Cookeaze kitchen.",
  },
  dinner: {
    title: "What's Cooking for Dinner Tonight?",
    body: "Let's find a delicious, comforting recipe to end your day on a high note!",
  },
};

function loadRecentHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
}

function saveRecentHistory(list) {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify((list || []).slice(0, 8))
    );
  } catch {
    // ignore storage errors
  }
}

function getCachedRecipes() {
  try {
    const raw =
      sessionStorage.getItem("cookeaze_recipes_catalog_v5") ||
      localStorage.getItem("cookeaze_recipes_catalog_v5") ||
      sessionStorage.getItem(RECIPES_CACHE_KEY) ||
      localStorage.getItem(RECIPES_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.items) && parsed.items.length > 0) {
      return parsed.items;
    }
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function extractRecipesPayload(resData) {
  if (!resData) return { results: [], count: 0 };
  const root = resData.data !== undefined ? resData.data : resData;
  if (Array.isArray(root)) {
    return { results: root, count: root.length };
  }
  const results = Array.isArray(root?.results)
    ? root.results
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

function parseJsonDraft(rawText) {
  const trimmed = String(rawText || "").trim();
  if (!trimmed) return { ok: true, value: {} };
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ok: true, value: parsed };
    }
    return {
      ok: false,
      error: 'Custom data must be a JSON object (e.g. {"screen": "home"}).',
    };
  } catch {
    return {
      ok: false,
      error: "Invalid JSON syntax. Check quotes and commas.",
    };
  }
}

function pickNumber(...candidates) {
  for (let i = 0; i < candidates.length; i += 1) {
    const val = candidates[i];
    if (typeof val === "number" && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === "string" && val.trim() !== "") {
      const cleaned = val.replace(/%/g, "").trim();
      const num = Number(cleaned);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return null;
}

function normalizeDeliveryReport(rawResponse, meta = {}) {
  const root = rawResponse && typeof rawResponse === "object" ? rawResponse : {};
  const inner =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? root.data
      : root;
  const delivery =
    inner.delivery && typeof inner.delivery === "object"
      ? inner.delivery
      : root.delivery && typeof root.delivery === "object"
      ? root.delivery
      : inner.stats && typeof inner.stats === "object"
      ? inner.stats
      : inner;
  const maintenance =
    inner.maintenance && typeof inner.maintenance === "object"
      ? inner.maintenance
      : root.maintenance && typeof root.maintenance === "object"
      ? root.maintenance
      : {};
  const metadata =
    inner.metadata && typeof inner.metadata === "object"
      ? inner.metadata
      : root.metadata && typeof root.metadata === "object"
      ? root.metadata
      : {};

  let totalDevices = pickNumber(
    delivery.total_devices,
    delivery.total_tokens,
    delivery.devices_count,
    delivery.target_devices,
    delivery.total,
    inner.total_devices,
    inner.total_tokens,
    inner.total,
    root.total_devices
  );

  let successCount = pickNumber(
    delivery.success_count,
    delivery.delivered_count,
    delivery.sent_count,
    delivery.successful_count,
    delivery.tokens_sent,
    typeof delivery.success === "number" ? delivery.success : null,
    inner.success_count,
    inner.delivered_count,
    inner.sent_count,
    root.success_count
  );

  let failureCount = pickNumber(
    delivery.failure_count,
    delivery.failed_count,
    delivery.failure,
    delivery.failed,
    inner.failure_count,
    inner.failed_count,
    root.failure_count
  );

  if (totalDevices !== null && successCount !== null && failureCount === null) {
    failureCount = Math.max(0, totalDevices - successCount);
  } else if (
    totalDevices === null &&
    successCount !== null &&
    failureCount !== null
  ) {
    totalDevices = successCount + failureCount;
  }

  let successRate = pickNumber(
    delivery.success_rate,
    inner.success_rate,
    root.success_rate
  );
  if (
    successRate === null &&
    totalDevices !== null &&
    totalDevices > 0 &&
    successCount !== null
  ) {
    successRate = Number(((successCount / totalDevices) * 100).toFixed(1));
  }

  const inactiveRemoved = pickNumber(
    maintenance.inactive_tokens_removed,
    inner.inactive_tokens_removed
  );
  const invalidCleaned = pickNumber(
    maintenance.invalid_tokens_cleaned,
    inner.invalid_tokens_cleaned
  );

  const notificationId =
    metadata.notification_id ||
    inner.notification_id ||
    root.notification_id ||
    null;

  const timestamp =
    metadata.timestamp ||
    inner.timestamp ||
    root.timestamp ||
    new Date().toISOString();

  const serverMessage =
    root.message ||
    inner.message ||
    delivery.message ||
    "Push notification dispatched to Cookeaze mobile devices.";

  return {
    state: meta.state || "completed",
    channel: meta.channel || "broadcast",
    title: meta.title || "",
    body: meta.body || "",
    serverMessage,
    totalDevices,
    successCount,
    failureCount,
    successRate,
    inactiveRemoved,
    invalidCleaned,
    notificationId,
    timestamp,
    hasDeviceBreakdown:
      totalDevices !== null || successCount !== null || failureCount !== null,
  };
}

export default function NotificationAdmin() {
  const { token } = useAuth() || {};
  const [activeTab, setActiveTab] = useState("broadcast"); // "broadcast" | "meal" | "recipe"
  const [previewPlatform, setPreviewPlatform] = useState("ios"); // "ios" | "android"
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Recipe Modal & Recipes State
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipes, setRecipes] = useState(() => getCachedRecipes().slice(0, 20));
  const [recipesCount, setRecipesCount] = useState(
    () => getCachedRecipes().length
  );
  const [recipePage, setRecipePage] = useState(1);
  const [recipeSearch, setRecipeSearch] = useState("");
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Telemetry & Feedback
  const [deliveryStats, setDeliveryStats] = useState(null);
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [recentHistory, setRecentHistory] = useState(() => loadRecentHistory());

  const broadcastImageInputRef = useRef(null);

  // Forms State
  const [broadcastForm, setBroadcastForm] = useState({
    title: "",
    body: "",
    image_url: "",
  });
  const [broadcastJsonText, setBroadcastJsonText] = useState("{}");

  const [mealForm, setMealForm] = useState({
    meal_type: "dinner",
    title: "",
    body: "",
  });
  const [mealJsonText, setMealJsonText] = useState("{}");

  const [recipeForm, setRecipeForm] = useState({
    recipe_id: null,
    recipe_name: "",
    title: "",
    body: "",
    recipe_image_url: "",
    meal_type: "dinner",
  });
  const [recipeJsonText, setRecipeJsonText] = useState("{}");

  const showNotification = useCallback((type, message) => {
    setNotification({ type, message });
  }, []);

  useEffect(() => {
    if (!notification.message) return undefined;
    const timer = setTimeout(() => {
      setNotification({ type: "", message: "" });
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.message]);

  const postWithAuth = useCallback(
    async (path, payload) => {
      let authToken = token || localStorage.getItem("token");
      if (!authToken) {
        authToken = await ensureValidToken();
      }
      if (!authToken) {
        throw new Error("You are not authenticated. Please log in.");
      }

      const executePost = async (bearer) =>
        fetch(`${API_BASE}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${bearer}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        });

      let res = await executePost(authToken);

      if (res.status === 401) {
        const refreshed = await ensureValidToken();
        if (refreshed && refreshed !== authToken) {
          res = await executePost(refreshed);
        }
      }

      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    [token]
  );

  const fetchRecipes = useCallback(async (page = 1, searchQuery = "") => {
    const q = searchQuery.trim().toLowerCase();
    setLoadingRecipes(true);

    try {
      const cached = getCachedRecipes();
      if (cached.length > 0) {
        const filtered = q
          ? cached.filter((r) => {
              const matchName = String(r.name || "")
                .toLowerCase()
                .includes(q);
              const matchCat = Array.isArray(r.category)
                ? r.category.some((c) => String(c).toLowerCase().includes(q))
                : false;
              return matchName || matchCat;
            })
          : cached;

        if (filtered.length > 0 || !q) {
          const start = (page - 1) * 20;
          setRecipes(filtered.slice(start, start + 20));
          setRecipesCount(filtered.length);
          setLoadingRecipes(false);
          return;
        }
      }

      let url = `${API_BASE}/recipes/?page=${page}`;
      if (searchQuery.trim()) {
        url += `&search=${encodeURIComponent(searchQuery.trim())}`;
      }
      const res = await axiosInstance.get(url);
      const { results, count } = extractRecipesPayload(res.data);

      const seen = new Set();
      const unique = [];
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i];
        if (r && r.id && !seen.has(String(r.id))) {
          seen.add(String(r.id));
          unique.push(r);
        }
      }

      setRecipes(unique);
      setRecipesCount(count || unique.length);
    } catch (err) {
      console.error("fetchRecipes error:", err);
      const cached = getCachedRecipes();
      if (cached.length > 0) {
        const start = (page - 1) * 20;
        setRecipes(cached.slice(start, start + 20));
        setRecipesCount(cached.length);
      } else {
        setRecipes([]);
      }
    } finally {
      setLoadingRecipes(false);
    }
  }, []);

  useEffect(() => {
    if (!showRecipeModal) return undefined;
    const timer = setTimeout(() => {
      fetchRecipes(recipePage, recipeSearch);
    }, 150);
    return () => clearTimeout(timer);
  }, [showRecipeModal, recipePage, recipeSearch, fetchRecipes]);

  const selectRecipe = (recipe) => {
    const cleanName = recipe.name || "Featured Recipe";
    setRecipeForm((prev) => ({
      ...prev,
      recipe_id: recipe.id,
      recipe_name: cleanName,
      recipe_image_url: recipe.image_url || "",
      title: `Try ${cleanName} Tonight!`,
      body: recipe.description
        ? String(recipe.description).slice(0, 140)
        : `Cook ${cleanName} in ${recipe.total_time || 30} mins with Cookeaze.`,
    }));
    setShowRecipeModal(false);
  };

  const handleBroadcastImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const uploadedUrl = await CloudinaryService.uploadFile(file, {
        folder: "cookeaze_notifications",
      });
      setBroadcastForm((prev) => ({ ...prev, image_url: uploadedUrl }));
      showNotification("success", "Image uploaded.");
    } catch {
      showNotification("error", "Failed to upload image.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  };

  const recordDispatch = (id, channel, payload, normalizedReport) => {
    const entry = {
      id: id || String(Date.now()),
      channel,
      title: payload.title,
      body: payload.body,
      image_url: payload.image_url || payload.recipe_image_url || "",
      meal_type: payload.meal_type || null,
      recipe_id: payload.recipe_id || null,
      recipe_name: payload.recipe_name || null,
      sentAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      total: normalizedReport?.totalDevices ?? null,
      success: normalizedReport?.successCount ?? null,
      status: normalizedReport?.state || "completed",
    };
    setRecentHistory((prev) => {
      const filtered = prev.filter((item) => item.id !== entry.id);
      const next = [entry, ...filtered].slice(0, 8);
      saveRecentHistory(next);
      return next;
    });
  };

  const dispatchNotification = async ({
    channel,
    endpoint,
    payload,
    successLabel,
    onResetForm,
  }) => {
    const dispatchId = String(Date.now());
    setLoading(true);

    const initialReport = normalizeDeliveryReport(
      {
        message:
          "Push notification handed off to FCM/APNs. Waiting for server delivery summary...",
      },
      {
        state: "sending",
        channel,
        title: payload.title,
        body: payload.body,
      }
    );
    setDeliveryStats(initialReport);
    recordDispatch(dispatchId, channel, payload, initialReport);

    let unlockedEarly = false;
    const earlyUnlockTimer = setTimeout(() => {
      unlockedEarly = true;
      setLoading(false);
      onResetForm();
      showNotification(
        "success",
        `${successLabel} dispatched! Finalizing device delivery report.`
      );
    }, 1800);

    try {
      const { ok, data } = await postWithAuth(endpoint, payload);
      clearTimeout(earlyUnlockTimer);

      const isSuccess =
        ok &&
        (data.success !== false &&
          (data.success ||
            data.isSuccessful ||
            data.status === "success" ||
            ok));

      if (isSuccess) {
        const finalReport = normalizeDeliveryReport(data, {
          state: "completed",
          channel,
          title: payload.title,
          body: payload.body,
        });
        setDeliveryStats(finalReport);
        recordDispatch(dispatchId, channel, payload, finalReport);

        if (!unlockedEarly) {
          onResetForm();
          showNotification("success", `${successLabel} sent!`);
        }
      } else {
        setDeliveryStats(null);
        showNotification(
          "error",
          data?.message || data?.detail || `Failed to send ${channel} notification.`
        );
      }
    } catch (err) {
      clearTimeout(earlyUnlockTimer);
      setDeliveryStats(null);
      showNotification(
        "error",
        err?.message || `Network error while sending ${channel} notification.`
      );
    } finally {
      setLoading(false);
    }
  };

  // 1. Broadcast Submit
  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const parsedJson = parseJsonDraft(broadcastJsonText);
    if (!parsedJson.ok) {
      showNotification("error", parsedJson.error);
      return;
    }

    const payload = {
      title: broadcastForm.title.trim(),
      body: broadcastForm.body.trim(),
      image_url: broadcastForm.image_url.trim(),
      custom_data: parsedJson.value,
    };

    await dispatchNotification({
      channel: "broadcast",
      endpoint: "/notifications/broadcast/",
      payload,
      successLabel: "Broadcast notification",
      onResetForm: () => {
        setBroadcastForm({ title: "", body: "", image_url: "" });
        setBroadcastJsonText("{}");
      },
    });
  };

  // 2. Meal Reminder Submit
  const handleMealSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    const parsedJson = parseJsonDraft(mealJsonText);
    if (!parsedJson.ok) {
      showNotification("error", parsedJson.error);
      return;
    }

    const payload = {
      meal_type: mealForm.meal_type,
      title: mealForm.title.trim(),
      body: mealForm.body.trim(),
      custom_data: parsedJson.value,
    };

    await dispatchNotification({
      channel: "meal",
      endpoint: "/notifications/meal/",
      payload,
      successLabel: "Meal reminder notification",
      onResetForm: () => {
        setMealForm({ meal_type: "dinner", title: "", body: "" });
        setMealJsonText("{}");
      },
    });
  };

  // 3. Recipe Feature Submit
  const handleRecipeSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!recipeForm.recipe_id) {
      showNotification("error", "Please select a recipe to feature first.");
      return;
    }

    const parsedJson = parseJsonDraft(recipeJsonText);
    if (!parsedJson.ok) {
      showNotification("error", parsedJson.error);
      return;
    }

    const payload = {
      recipe_id: recipeForm.recipe_id,
      recipe_name: recipeForm.recipe_name,
      title: recipeForm.title.trim(),
      body: recipeForm.body.trim(),
      recipe_image_url: recipeForm.recipe_image_url,
      meal_type: recipeForm.meal_type,
      custom_data: parsedJson.value,
    };

    await dispatchNotification({
      channel: "recipe",
      endpoint: "/notifications/recipe/",
      payload,
      successLabel: "Recipe feature notification",
      onResetForm: () => {
        setRecipeForm({
          recipe_id: null,
          recipe_name: "",
          title: "",
          body: "",
          recipe_image_url: "",
          meal_type: "dinner",
        });
        setRecipeJsonText("{}");
      },
    });
  };

  const handleResetActiveForm = () => {
    if (activeTab === "broadcast") {
      setBroadcastForm({ title: "", body: "", image_url: "" });
      setBroadcastJsonText("{}");
    } else if (activeTab === "meal") {
      setMealForm({ meal_type: "dinner", title: "", body: "" });
      setMealJsonText("{}");
    } else {
      setRecipeForm({
        recipe_id: null,
        recipe_name: "",
        title: "",
        body: "",
        recipe_image_url: "",
        meal_type: "dinner",
      });
      setRecipeJsonText("{}");
    }
  };

  const handleReuseHistoryItem = (item) => {
    setActiveTab(item.channel);
    if (item.channel === "broadcast") {
      setBroadcastForm({
        title: item.title || "",
        body: item.body || "",
        image_url: item.image_url || "",
      });
    } else if (item.channel === "meal") {
      setMealForm({
        meal_type: item.meal_type || "dinner",
        title: item.title || "",
        body: item.body || "",
      });
    } else if (item.channel === "recipe") {
      setRecipeForm((prev) => ({
        ...prev,
        recipe_id: item.recipe_id || prev.recipe_id,
        recipe_name: item.recipe_name || prev.recipe_name,
        recipe_image_url: item.image_url || prev.recipe_image_url,
        meal_type: item.meal_type || "dinner",
        title: item.title || "",
        body: item.body || "",
      }));
    }
  };

  // Active Preview Values
  const activePreview =
    activeTab === "broadcast"
      ? {
          title: broadcastForm.title.trim() || "Notification Title",
          body:
            broadcastForm.body.trim() ||
            "Your notification message will appear here as you type.",
          image: broadcastForm.image_url.trim(),
        }
      : activeTab === "meal"
      ? {
          title:
            mealForm.title.trim() ||
            MEAL_PRESETS[mealForm.meal_type]?.title ||
            "What's Cooking Tonight?",
          body:
            mealForm.body.trim() ||
            "Your meal reminder message will appear here.",
          image: "",
        }
      : {
          title:
            recipeForm.title.trim() ||
            (recipeForm.recipe_name
              ? `Try ${recipeForm.recipe_name} Tonight!`
              : "Featured Recipe"),
          body:
            recipeForm.body.trim() ||
            "Tap to view full ingredients and step-by-step cooking instructions.",
          image: recipeForm.recipe_image_url,
        };

  const activeJsonCheck = parseJsonDraft(
    activeTab === "broadcast"
      ? broadcastJsonText
      : activeTab === "meal"
      ? mealJsonText
      : recipeJsonText
  );

  const totalRecipePages = Math.max(1, Math.ceil(recipesCount / 20));

  return (
    <div className="ntf-page">
      <input
        ref={broadcastImageInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleBroadcastImageUpload}
      />

      {/* ── Page Header ── */}
      <header className="ntf-header">
        <div>
          <h1 className="ntf-title">Push Notifications</h1>
          <p className="ntf-subtitle">
            Compose, preview, and send push notifications to Cookeaze mobile users.
          </p>
        </div>

        <button
          type="button"
          className="ntf-btn"
          onClick={handleResetActiveForm}
        >
          <RotateCcw size={14} />
          Reset
        </button>
      </header>

      {/* ── Toast Notification ── */}
      {notification.message && (
        <div
          role="alert"
          aria-live="polite"
          className={`ntf-toast ${
            notification.type === "success"
              ? "ntf-toast-success"
              : "ntf-toast-error"
          }`}
        >
          <div className="ntf-toast-left">
            {notification.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            className="ntf-toast-close"
            onClick={() => setNotification({ type: "", message: "" })}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ── 2-Column Workspace: Clean Composer + Live Mobile Preview ── */}
      <div className="ntf-workspace">
        {/* LEFT COLUMN: Clean Notification Composer */}
        <section className="ntf-card">
          <div className="ntf-card-header">
            <h2 className="ntf-card-title">Compose Notification</h2>
          </div>

          <div className="ntf-card-body">
            {/* Clean 3-Segment Channel Switcher */}
            <div className="ntf-channel-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "broadcast"}
                className={`ntf-channel-tab ${
                  activeTab === "broadcast" ? "active" : ""
                }`}
                onClick={() => setActiveTab("broadcast")}
              >
                Broadcast
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "meal"}
                className={`ntf-channel-tab ${
                  activeTab === "meal" ? "active" : ""
                }`}
                onClick={() => setActiveTab("meal")}
              >
                Meal Reminder
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "recipe"}
                className={`ntf-channel-tab ${
                  activeTab === "recipe" ? "active" : ""
                }`}
                onClick={() => setActiveTab("recipe")}
              >
                Recipe Feature
              </button>
            </div>

            {/* ── TAB 1: BROADCAST FORM ── */}
            {activeTab === "broadcast" && (
              <form onSubmit={handleBroadcastSubmit} className="ntf-form-stack">
                <div className="ntf-template-row">
                  <span className="ntf-template-label">Templates:</span>
                  {BROADCAST_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      className="ntf-template-chip"
                      onClick={() =>
                        setBroadcastForm((prev) => ({
                          ...prev,
                          title: preset.title,
                          body: preset.body,
                        }))
                      }
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="broadcast-title" className="ntf-label">
                      Title<span className="ntf-req">*</span>
                    </label>
                    <span
                      className={`ntf-counter ${
                        broadcastForm.title.length > 65 ? "over" : ""
                      }`}
                    >
                      {broadcastForm.title.length} / 65
                    </span>
                  </div>
                  <input
                    id="broadcast-title"
                    type="text"
                    className="ntf-input"
                    required
                    value={broadcastForm.title}
                    onChange={(e) =>
                      setBroadcastForm({
                        ...broadcastForm,
                        title: e.target.value,
                      })
                    }
                    placeholder="e.g. Fresh Weekend Recipes Are Here!"
                  />
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="broadcast-body" className="ntf-label">
                      Message<span className="ntf-req">*</span>
                    </label>
                    <span
                      className={`ntf-counter ${
                        broadcastForm.body.length > 180 ? "over" : ""
                      }`}
                    >
                      {broadcastForm.body.length} / 180
                    </span>
                  </div>
                  <textarea
                    id="broadcast-body"
                    className="ntf-textarea"
                    rows={3}
                    required
                    value={broadcastForm.body}
                    onChange={(e) =>
                      setBroadcastForm({
                        ...broadcastForm,
                        body: e.target.value,
                      })
                    }
                    placeholder="Write a clear message for Cookeaze users..."
                  />
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="broadcast-image" className="ntf-label">
                      Image (Optional)
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {broadcastForm.image_url && (
                        <button
                          type="button"
                          className="ntf-btn ntf-btn-sm"
                          onClick={() =>
                            setBroadcastForm((prev) => ({
                              ...prev,
                              image_url: "",
                            }))
                          }
                        >
                          Remove
                        </button>
                      )}
                      <button
                        type="button"
                        className="ntf-btn ntf-btn-sm"
                        onClick={() => broadcastImageInputRef.current?.click()}
                        disabled={uploadingImage}
                      >
                        <Upload size={12} />
                        {uploadingImage ? "Uploading..." : "Upload Image"}
                      </button>
                    </div>
                  </div>
                  <input
                    id="broadcast-image"
                    type="url"
                    className="ntf-input"
                    value={broadcastForm.image_url}
                    onChange={(e) =>
                      setBroadcastForm({
                        ...broadcastForm,
                        image_url: e.target.value,
                      })
                    }
                    placeholder="Paste image URL or click Upload Image..."
                  />
                </div>

                <button
                  type="button"
                  className="ntf-advanced-toggle"
                  onClick={() => setShowAdvancedJson((v) => !v)}
                >
                  {showAdvancedJson ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  Advanced JSON Payload
                </button>

                {showAdvancedJson && (
                  <div className="ntf-field">
                    <div className="ntf-label-row">
                      <label htmlFor="broadcast-json" className="ntf-label">
                        Custom Data (JSON)
                      </label>
                      {!activeJsonCheck.ok && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "#dc2626",
                            fontWeight: 600,
                          }}
                        >
                          {activeJsonCheck.error}
                        </span>
                      )}
                    </div>
                    <textarea
                      id="broadcast-json"
                      className="ntf-textarea ntf-textarea-mono"
                      rows={2}
                      value={broadcastJsonText}
                      onChange={(e) => setBroadcastJsonText(e.target.value)}
                      placeholder='{"screen": "home"}'
                    />
                  </div>
                )}

                <div className="ntf-composer-footer">
                  <button
                    type="submit"
                    className="ntf-btn ntf-btn-primary ntf-btn-lg"
                    disabled={loading}
                  >
                    <Send size={14} />
                    {loading ? "Sending..." : "Send Broadcast"}
                  </button>
                </div>
              </form>
            )}

            {/* ── TAB 2: MEAL REMINDER FORM ── */}
            {activeTab === "meal" && (
              <form onSubmit={handleMealSubmit} className="ntf-form-stack">
                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <span className="ntf-label">Meal Time</span>
                    <button
                      type="button"
                      className="ntf-btn ntf-btn-sm"
                      onClick={() => {
                        const preset = MEAL_PRESETS[mealForm.meal_type];
                        if (preset) {
                          setMealForm((prev) => ({
                            ...prev,
                            title: preset.title,
                            body: preset.body,
                          }));
                        }
                      }}
                    >
                      Use {mealForm.meal_type} template
                    </button>
                  </div>

                  <div className="ntf-segmented-3">
                    {["breakfast", "lunch", "dinner"].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        className={`ntf-segment-btn ${
                          mealForm.meal_type === opt ? "active" : ""
                        }`}
                        onClick={() =>
                          setMealForm((prev) => ({
                            ...prev,
                            meal_type: opt,
                          }))
                        }
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="meal-title" className="ntf-label">
                      Title<span className="ntf-req">*</span>
                    </label>
                    <span
                      className={`ntf-counter ${
                        mealForm.title.length > 65 ? "over" : ""
                      }`}
                    >
                      {mealForm.title.length} / 65
                    </span>
                  </div>
                  <input
                    id="meal-title"
                    type="text"
                    className="ntf-input"
                    required
                    value={mealForm.title}
                    onChange={(e) =>
                      setMealForm({ ...mealForm, title: e.target.value })
                    }
                    placeholder="e.g. What's Cooking for Dinner Tonight?"
                  />
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="meal-body" className="ntf-label">
                      Message<span className="ntf-req">*</span>
                    </label>
                    <span
                      className={`ntf-counter ${
                        mealForm.body.length > 180 ? "over" : ""
                      }`}
                    >
                      {mealForm.body.length} / 180
                    </span>
                  </div>
                  <textarea
                    id="meal-body"
                    className="ntf-textarea"
                    rows={3}
                    required
                    value={mealForm.body}
                    onChange={(e) =>
                      setMealForm({ ...mealForm, body: e.target.value })
                    }
                    placeholder="Write a short meal reminder message..."
                  />
                </div>

                <button
                  type="button"
                  className="ntf-advanced-toggle"
                  onClick={() => setShowAdvancedJson((v) => !v)}
                >
                  {showAdvancedJson ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  Advanced JSON Payload
                </button>

                {showAdvancedJson && (
                  <div className="ntf-field">
                    <div className="ntf-label-row">
                      <label htmlFor="meal-json" className="ntf-label">
                        Custom Data (JSON)
                      </label>
                      {!activeJsonCheck.ok && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "#dc2626",
                            fontWeight: 600,
                          }}
                        >
                          {activeJsonCheck.error}
                        </span>
                      )}
                    </div>
                    <textarea
                      id="meal-json"
                      className="ntf-textarea ntf-textarea-mono"
                      rows={2}
                      value={mealJsonText}
                      onChange={(e) => setMealJsonText(e.target.value)}
                      placeholder='{"campaign": "evening_reminder"}'
                    />
                  </div>
                )}

                <div className="ntf-composer-footer">
                  <button
                    type="submit"
                    className="ntf-btn ntf-btn-primary ntf-btn-lg"
                    disabled={loading}
                  >
                    <Send size={14} />
                    {loading ? "Sending..." : "Send Meal Reminder"}
                  </button>
                </div>
              </form>
            )}

            {/* ── TAB 3: RECIPE FEATURE FORM ── */}
            {activeTab === "recipe" && (
              <form onSubmit={handleRecipeSubmit} className="ntf-form-stack">
                <div className="ntf-field">
                  <span className="ntf-label">
                    Featured Recipe<span className="ntf-req">*</span>
                  </span>
                  <div
                    className={`ntf-recipe-selector ${
                      recipeForm.recipe_id ? "selected" : ""
                    }`}
                  >
                    {recipeForm.recipe_id ? (
                      <div className="ntf-recipe-left">
                        {recipeForm.recipe_image_url && (
                          <img
                            src={recipeForm.recipe_image_url}
                            alt={recipeForm.recipe_name}
                            className="ntf-recipe-thumb"
                          />
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div className="ntf-recipe-title">
                            {recipeForm.recipe_name}
                          </div>
                          <div className="ntf-recipe-sub">
                            Recipe #{recipeForm.recipe_id}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ minWidth: 0 }}>
                        <div className="ntf-recipe-title">
                          No recipe selected
                        </div>
                        <div className="ntf-recipe-sub">
                          Choose a recipe from your catalog to feature
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      className="ntf-btn ntf-btn-primary"
                      onClick={() => setShowRecipeModal(true)}
                    >
                      {recipeForm.recipe_id ? "Change Recipe" : "Select Recipe"}
                    </button>
                  </div>
                </div>

                <div className="ntf-field">
                  <span className="ntf-label">Meal Category</span>
                  <div className="ntf-segmented-3">
                    {["breakfast", "lunch", "dinner"].map((mealType) => (
                      <button
                        key={mealType}
                        type="button"
                        className={`ntf-segment-btn ${
                          recipeForm.meal_type === mealType ? "active" : ""
                        }`}
                        onClick={() =>
                          setRecipeForm((prev) => ({
                            ...prev,
                            meal_type: mealType,
                          }))
                        }
                      >
                        {mealType}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="recipe-title" className="ntf-label">
                      Title<span className="ntf-req">*</span>
                    </label>
                    <span
                      className={`ntf-counter ${
                        recipeForm.title.length > 65 ? "over" : ""
                      }`}
                    >
                      {recipeForm.title.length} / 65
                    </span>
                  </div>
                  <input
                    id="recipe-title"
                    type="text"
                    className="ntf-input"
                    required
                    value={recipeForm.title}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, title: e.target.value })
                    }
                    placeholder="Select a recipe above or enter a title..."
                  />
                </div>

                <div className="ntf-field">
                  <div className="ntf-label-row">
                    <label htmlFor="recipe-body" className="ntf-label">
                      Message<span className="ntf-req">*</span>
                    </label>
                    <span
                      className={`ntf-counter ${
                        recipeForm.body.length > 180 ? "over" : ""
                      }`}
                    >
                      {recipeForm.body.length} / 180
                    </span>
                  </div>
                  <textarea
                    id="recipe-body"
                    className="ntf-textarea"
                    rows={3}
                    required
                    value={recipeForm.body}
                    onChange={(e) =>
                      setRecipeForm({ ...recipeForm, body: e.target.value })
                    }
                    placeholder="Enter notification message..."
                  />
                </div>

                <button
                  type="button"
                  className="ntf-advanced-toggle"
                  onClick={() => setShowAdvancedJson((v) => !v)}
                >
                  {showAdvancedJson ? (
                    <ChevronUp size={14} />
                  ) : (
                    <ChevronDown size={14} />
                  )}
                  Advanced JSON Payload
                </button>

                {showAdvancedJson && (
                  <div className="ntf-field">
                    <div className="ntf-label-row">
                      <label htmlFor="recipe-json" className="ntf-label">
                        Custom Data (JSON)
                      </label>
                      {!activeJsonCheck.ok && (
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "#dc2626",
                            fontWeight: 600,
                          }}
                        >
                          {activeJsonCheck.error}
                        </span>
                      )}
                    </div>
                    <textarea
                      id="recipe-json"
                      className="ntf-textarea ntf-textarea-mono"
                      rows={2}
                      value={recipeJsonText}
                      onChange={(e) => setRecipeJsonText(e.target.value)}
                      placeholder='{"featured": true}'
                    />
                  </div>
                )}

                <div className="ntf-composer-footer">
                  <button
                    type="submit"
                    className="ntf-btn ntf-btn-primary ntf-btn-lg"
                    disabled={loading}
                  >
                    <Send size={14} />
                    {loading ? "Sending..." : "Send Recipe Notification"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        {/* RIGHT COLUMN: Clean Live Mobile Preview + Delivery Report + History */}
        <aside className="ntf-side">
          {/* LIVE DEVICE PREVIEW CARD */}
          <section className="ntf-card">
            <div className="ntf-card-header">
              <h2 className="ntf-card-title">Live Preview</h2>

              <div className="ntf-preview-os-toggle">
                <button
                  type="button"
                  className={`ntf-os-btn ${
                    previewPlatform === "ios" ? "active" : ""
                  }`}
                  onClick={() => setPreviewPlatform("ios")}
                >
                  iOS
                </button>
                <button
                  type="button"
                  className={`ntf-os-btn ${
                    previewPlatform === "android" ? "active" : ""
                  }`}
                  onClick={() => setPreviewPlatform("android")}
                >
                  Android
                </button>
              </div>
            </div>

            <div className="ntf-card-body">
              <div className="ntf-phone-frame">
                <div className="ntf-phone-statusbar">
                  <span>9:41</span>
                  <span>
                    {previewPlatform === "ios"
                      ? "Cookeaze iOS"
                      : "Cookeaze Android"}
                  </span>
                </div>

                {previewPlatform === "ios" && (
                  <div className="ntf-phone-clock-wrap">
                    <div className="ntf-phone-clock-time">9:41</div>
                    <div className="ntf-phone-clock-date">
                      Wednesday, November 4
                    </div>
                  </div>
                )}

                <div className="ntf-notif-card">
                  <div className="ntf-notif-top">
                    <div className="ntf-notif-app">
                      <span className="ntf-notif-app-icon">C</span>
                      <span>COOKEAZE</span>
                    </div>
                    <span className="ntf-notif-time">now</span>
                  </div>

                  <div className="ntf-notif-main">
                    <div className="ntf-notif-copy">
                      <div className="ntf-notif-title">
                        {activePreview.title}
                      </div>
                      <div className="ntf-notif-body">{activePreview.body}</div>
                    </div>

                    {activePreview.image && (
                      <img
                        src={activePreview.image}
                        alt=""
                        className="ntf-notif-mini-thumb"
                      />
                    )}
                  </div>

                  {activePreview.image && (
                    <img
                      src={activePreview.image}
                      alt="Rich notification banner"
                      className="ntf-notif-rich-banner"
                    />
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* LIVE DELIVERY REPORT (Shown when a notification is sent) */}
          {deliveryStats && (
            <DeliveryReportPanel
              stats={deliveryStats}
              onClose={() => setDeliveryStats(null)}
            />
          )}

          {/* RECENT DISPATCHES */}
          <section className="ntf-card">
            <div className="ntf-card-header">
              <h2 className="ntf-card-title">Recent Dispatches</h2>
              {recentHistory.length > 0 && (
                <button
                  type="button"
                  className="ntf-btn ntf-btn-sm"
                  onClick={() => {
                    setRecentHistory([]);
                    saveRecentHistory([]);
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="ntf-card-body">
              {recentHistory.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "16px 8px",
                    color: "#64748b",
                    fontSize: "0.78rem",
                  }}
                >
                  Sent notifications will appear here for 1-click reuse.
                </div>
              ) : (
                <div className="ntf-history-list">
                  {recentHistory.map((item) => (
                    <div key={item.id} className="ntf-history-item">
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <span className="ntf-badge ntf-badge-emerald">
                          {String(item.channel || "broadcast").toUpperCase()}
                        </span>
                        <div className="ntf-history-title">{item.title}</div>
                        <div className="ntf-history-body">{item.body}</div>
                        <div className="ntf-history-meta">
                          Sent at {item.sentAt}
                          {typeof item.total === "number" && item.total > 0
                            ? ` • ${item.success ?? 0}/${item.total} delivered`
                            : " • Delivered to devices"}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ntf-btn ntf-btn-sm"
                        onClick={() => handleReuseHistoryItem(item)}
                      >
                        Reuse
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>

      {/* ── Recipe Picker Modal ── */}
      {showRecipeModal && (
        <div
          className="ntf-modal-backdrop"
          onClick={() => setShowRecipeModal(false)}
        >
          <div
            className="ntf-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ntf-modal-header">
              <h2 className="ntf-card-title">Select Recipe to Feature</h2>
              <button
                type="button"
                className="ntf-toast-close"
                onClick={() => setShowRecipeModal(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="ntf-modal-search">
              <input
                type="text"
                className="ntf-input"
                placeholder="Search recipes by title..."
                value={recipeSearch}
                onChange={(e) => {
                  setRecipeSearch(e.target.value);
                  setRecipePage(1);
                }}
                autoFocus
              />
              {recipeSearch && (
                <button
                  type="button"
                  className="ntf-btn ntf-btn-sm"
                  onClick={() => {
                    setRecipeSearch("");
                    setRecipePage(1);
                  }}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="ntf-modal-body">
              {loadingRecipes ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 20px",
                    color: "#64748b",
                    fontSize: "0.82rem",
                  }}
                >
                  Loading recipes...
                </div>
              ) : recipes.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "36px 20px",
                    color: "#64748b",
                    fontSize: "0.82rem",
                  }}
                >
                  No recipes found matching your search.
                </div>
              ) : (
                <div className="ntf-recipe-grid">
                  {recipes.map((recipe) => {
                    const isSelected =
                      Number(recipeForm.recipe_id) === Number(recipe.id);
                    return (
                      <button
                        key={recipe.id}
                        type="button"
                        className={`ntf-recipe-card ${
                          isSelected ? "selected" : ""
                        }`}
                        onClick={() => selectRecipe(recipe)}
                      >
                        {recipe.image_url ? (
                          <img
                            src={recipe.image_url}
                            alt={recipe.name}
                            className="ntf-recipe-thumb"
                            loading="lazy"
                          />
                        ) : (
                          <div className="ntf-recipe-thumb" />
                        )}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="ntf-recipe-title">{recipe.name}</div>
                          <div className="ntf-recipe-sub">
                            {recipe.total_time || 0} mins •{" "}
                            {recipe.servings || 1} servings
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="ntf-modal-footer">
              <span>
                Page {recipePage} of {totalRecipePages}
                {recipesCount > 0 ? ` (${recipesCount} recipes)` : ""}
              </span>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="ntf-btn ntf-btn-sm"
                  disabled={recipePage <= 1 || loadingRecipes}
                  onClick={() => setRecipePage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="ntf-btn ntf-btn-sm"
                  disabled={recipePage >= totalRecipePages || loadingRecipes}
                  onClick={() =>
                    setRecipePage((p) => Math.min(totalRecipePages, p + 1))
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

function DeliveryReportPanel({ stats, onClose }) {
  if (!stats) return null;

  const isSending = stats.state === "sending";
  const total = stats.totalDevices ?? 0;
  const success = stats.successCount ?? 0;
  const failure = stats.failureCount ?? Math.max(0, total - success);
  const rate =
    stats.successRate !== null && stats.successRate !== undefined
      ? stats.successRate
      : total > 0
      ? ((success / total) * 100).toFixed(1)
      : "100.0";

  return (
    <section className="ntf-card">
      <div className="ntf-card-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <h2 className="ntf-card-title">Delivery Report</h2>
          <span
            className={`ntf-badge ${
              isSending ? "ntf-badge-amber" : "ntf-badge-emerald"
            }`}
          >
            {isSending ? (
              <>
                <Clock size={11} />
                Syncing
              </>
            ) : (
              <>
                <CheckCircle2 size={11} />
                Delivered
              </>
            )}
          </span>
        </div>

        <button type="button" className="ntf-toast-close" onClick={onClose}>
          <X size={15} />
        </button>
      </div>

      <div className="ntf-card-body">
        <div
          style={{
            background: isSending ? "#fffbeb" : "#f0fdf4",
            border: `1px solid ${isSending ? "#fde68a" : "#bbf7d0"}`,
            borderRadius: "6px",
            padding: "10px 12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: isSending ? "#92400e" : "#166534",
              marginBottom: "2px",
            }}
          >
            {stats.title || "Push Notification"}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: isSending ? "#b45309" : "#15803d",
              lineHeight: 1.45,
            }}
          >
            {stats.serverMessage}
          </div>
        </div>

        {stats.hasDeviceBreakdown ? (
          <div className="ntf-stats-grid">
            <div className="ntf-stat-box">
              <div className="ntf-stat-label">Total Devices</div>
              <div className="ntf-stat-val">{total.toLocaleString()}</div>
            </div>
            <div className="ntf-stat-box">
              <div className="ntf-stat-label">Success Rate</div>
              <div className="ntf-stat-val" style={{ color: "#15803d" }}>
                {rate}%
              </div>
            </div>
            <div className="ntf-stat-box">
              <div className="ntf-stat-label">Delivered</div>
              <div className="ntf-stat-val" style={{ color: "#15803d" }}>
                {success.toLocaleString()}
              </div>
            </div>
            <div className="ntf-stat-box">
              <div className="ntf-stat-label">Failed</div>
              <div className="ntf-stat-val" style={{ color: "#dc2626" }}>
                {failure.toLocaleString()}
              </div>
            </div>
          </div>
        ) : (
          <div className="ntf-stats-grid">
            <div className="ntf-stat-box">
              <div className="ntf-stat-label">Status</div>
              <div
                className="ntf-stat-val"
                style={{ fontSize: "0.9rem", color: "#15803d" }}
              >
                {isSending ? "Delivering..." : "Delivered"}
              </div>
            </div>
            <div className="ntf-stat-box">
              <div className="ntf-stat-label">Channel</div>
              <div
                className="ntf-stat-val"
                style={{
                  fontSize: "0.9rem",
                  textTransform: "capitalize",
                }}
              >
                {stats.channel}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
