// src/pages/CampaignsPage.js
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Edit2,
  Trash2,
  X,
  Check,
  Copy,
  CheckCircle2,
  AlertCircle,
  Tag,
  Download,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./CampaignsPage.css";

const RECIPES_CACHE_KEY = "cookeaze_recipes_catalog_v5";

const DISCOUNT_PRESETS = [
  "10% OFF",
  "15% OFF",
  "20% OFF",
  "50% OFF",
  "Free Delivery",
];

const PERIOD_OPTIONS = [
  { key: "all", label: "All Time" },
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "custom", label: "Custom" },
];

function extractList(payload, preferredKeys = []) {
  const root = payload?.data !== undefined ? payload.data : payload;
  if (!root) return [];
  if (Array.isArray(root)) return root;

  for (const key of preferredKeys) {
    if (Array.isArray(root[key])) return root[key];
    if (root.data && Array.isArray(root.data[key])) return root.data[key];
  }

  const commonKeys = [
    "campaigns",
    "users",
    "creators",
    "recipes",
    "results",
    "data",
    "items",
  ];
  for (const key of commonKeys) {
    if (Array.isArray(root[key])) return root[key];
    if (root.data && Array.isArray(root.data[key])) return root.data[key];
  }
  return [];
}

function extractObject(payload) {
  const root = payload?.data !== undefined ? payload.data : payload;
  if (!root || typeof root !== "object") return null;
  if (root.campaign && typeof root.campaign === "object") return root.campaign;
  if (root.data && typeof root.data === "object" && !Array.isArray(root.data)) {
    return root.data;
  }
  return root;
}

function formatSmartName(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s === s.toUpperCase() && s.length > 3) {
    return s
      .toLowerCase()
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  return s;
}

function formatShortDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isWithinPeriod(dateStr, period, customFrom, customTo) {
  if (period === "all") return true;
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;

  const now = new Date();
  if (period === "today") {
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    return d >= startOfToday;
  }

  if (period === "week") {
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= sevenDaysAgo;
  }

  if (period === "month") {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return d >= thirtyDaysAgo;
  }

  if (period === "custom") {
    if (customFrom) {
      const fromDate = new Date(`${customFrom}T00:00:00`);
      if (!Number.isNaN(fromDate.getTime()) && d < fromDate) return false;
    }
    if (customTo) {
      const toDate = new Date(`${customTo}T23:59:59`);
      if (!Number.isNaN(toDate.getTime()) && d > toDate) return false;
    }
    return true;
  }

  return true;
}

function normalizeCreatorOption(c) {
  if (!c || typeof c !== "object") return null;
  const id = c.id ?? c.user_id ?? c.creator_id;
  if (id === undefined || id === null) return null;

  const fullName = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  const rawName =
    c.creator_name ||
    c.name ||
    c.display_name ||
    c.username ||
    fullName ||
    c.email ||
    `Creator #${id}`;

  return {
    id: Number(id),
    name: formatSmartName(rawName),
    email: c.email || "",
  };
}

function normalizeCampaignUser(u, index) {
  if (!u || typeof u !== "object") return null;
  const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  const displayName = formatSmartName(
    u.full_name ||
      u.name ||
      fullName ||
      u.username ||
      (u.email ? u.email.split("@")[0] : `User #${u.id || index + 1}`)
  );

  return {
    id: u.id ?? `u-${index}`,
    name: displayName,
    email: u.email || "—",
    role: u.role || (u.is_creator ? "creator" : "user"),
    created_at:
      u.date_joined || u.created_at || u.registered_at || u.signup_date || null,
    last_login: u.last_login || null,
  };
}

function normalizeCampaign(raw, creatorsMap, recipesMap, usersByCampaignMap) {
  if (!raw || typeof raw !== "object") return null;

  const creatorObj =
    typeof raw.creator === "object" && raw.creator !== null
      ? raw.creator
      : null;

  const creatorIdRaw =
    raw.creator_id ??
    creatorObj?.id ??
    creatorObj?.user_id ??
    (typeof raw.creator === "number" || typeof raw.creator === "string"
      ? raw.creator
      : null);

  const creatorId =
    creatorIdRaw !== null &&
    creatorIdRaw !== undefined &&
    creatorIdRaw !== "" &&
    !Number.isNaN(Number(creatorIdRaw))
      ? Number(creatorIdRaw)
      : null;

  const mappedCreator = creatorId ? creatorsMap.get(creatorId) : null;

  const creatorName = formatSmartName(
    raw.creator_name ||
      creatorObj?.creator_name ||
      creatorObj?.name ||
      creatorObj?.username ||
      [creatorObj?.first_name, creatorObj?.last_name]
        .filter(Boolean)
        .join(" ") ||
      mappedCreator?.name ||
      ""
  );

  const creatorEmail =
    raw.creator_email || creatorObj?.email || mappedCreator?.email || "";

  const rawRecipes = Array.isArray(raw.recipes) ? raw.recipes : [];
  const rawRecipeIds = Array.isArray(raw.recipe_ids) ? raw.recipe_ids : [];

  const recipeIdsSet = new Set();
  const resolvedRecipes = [];

  rawRecipes.forEach((r) => {
    if (typeof r === "object" && r !== null && r.id !== undefined) {
      const numId = Number(r.id);
      if (!Number.isNaN(numId) && !recipeIdsSet.has(numId)) {
        recipeIdsSet.add(numId);
        resolvedRecipes.push({
          id: numId,
          name:
            r.name ||
            r.title ||
            recipesMap.get(numId)?.name ||
            `Recipe #${numId}`,
        });
      }
    } else if (r !== null && r !== undefined && !Number.isNaN(Number(r))) {
      const numId = Number(r);
      if (!recipeIdsSet.has(numId)) {
        recipeIdsSet.add(numId);
        resolvedRecipes.push({
          id: numId,
          name: recipesMap.get(numId)?.name || `Recipe #${numId}`,
        });
      }
    }
  });

  rawRecipeIds.forEach((idVal) => {
    const numId = Number(idVal);
    if (!Number.isNaN(numId) && !recipeIdsSet.has(numId)) {
      recipeIdsSet.add(numId);
      resolvedRecipes.push({
        id: numId,
        name: recipesMap.get(numId)?.name || `Recipe #${numId}`,
      });
    }
  });

  const recipeIds = Array.from(recipeIdsSet);
  const preloadedUsers = usersByCampaignMap.get(Number(raw.id)) || [];

  const totalSignups = Number(
    raw.users_count ??
      raw.user_count ??
      raw.signup_count ??
      raw.signups_count ??
      raw.total_signups ??
      raw.attributed_users_count ??
      (preloadedUsers.length > 0
        ? preloadedUsers.length
        : Array.isArray(raw.users)
        ? raw.users.length
        : 0)
  );

  return {
    id: raw.id,
    name: String(raw.name || `Campaign #${raw.id}`).trim(),
    creator_id: creatorId,
    creator_name: creatorName,
    creator_email: creatorEmail,
    discount_label: raw.discount_label ? String(raw.discount_label).trim() : "",
    description: raw.description ? String(raw.description).trim() : "",
    recipe_ids: recipeIds,
    recipes: resolvedRecipes,
    recipes_count:
      raw.recipes_count !== undefined
        ? Number(raw.recipes_count)
        : recipeIds.length,
    signups_count: Number.isNaN(totalSignups) ? 0 : totalSignups,
    users_list: preloadedUsers,
    created_at: raw.created_at || raw.date_created || null,
  };
}

export default function CampaignsPage() {
  const [campaignsRaw, setCampaignsRaw] = useState([]);
  const [usersByCampaign, setUsersByCampaign] = useState(new Map());
  const [creators, setCreators] = useState([]);
  const [recipesCatalog, setRecipesCatalog] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Period Filter (All Time | Today | This Week | This Month | Custom)
  const [periodFilter, setPeriodFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Create / Edit Modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [formName, setFormName] = useState("");
  const [formCreatorId, setFormCreatorId] = useState("");
  const [formDiscountLabel, setFormDiscountLabel] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formRecipeIds, setFormRecipeIds] = useState([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState("");
  const [submittingForm, setSubmittingForm] = useState(false);

  // Campaign Details & Attributed Users Modal (`GET /api/campaigns/{id}/` & `GET /api/campaigns/{id}/users/`)
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignUsers, setCampaignUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [modalPeriodFilter, setModalPeriodFilter] = useState("all");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [copiedKey, setCopiedKey] = useState(null);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleCopyText = (text, key) => {
    if (!text) return;
    navigator.clipboard?.writeText(String(text));
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1800);
  };

  const loadRecipesForPicker = useCallback(async (api) => {
    try {
      const cachedRaw = localStorage.getItem(RECIPES_CACHE_KEY);
      if (cachedRaw) {
        const parsed = JSON.parse(cachedRaw);
        const list = Array.isArray(parsed?.items)
          ? parsed.items
          : Array.isArray(parsed)
          ? parsed
          : [];
        if (list.length > 0) {
          setRecipesCatalog(
            list.map((r) => ({
              id: Number(r.id),
              name: String(r.name || r.title || `Recipe #${r.id}`).trim(),
              creator_name: r.creator_name || "",
            }))
          );
          return;
        }
      }
    } catch {
      // ignore cache errors
    }

    try {
      const res = await api.get("/recipes/?page=1");
      const list = extractList(res, ["recipes", "results", "data"]);
      const normalized = list
        .filter((r) => r && r.id !== undefined)
        .map((r) => ({
          id: Number(r.id),
          name: String(r.name || r.title || `Recipe #${r.id}`).trim(),
          creator_name: r.creator_name || "",
        }));
      if (normalized.length > 0) {
        setRecipesCatalog(normalized);
      }
    } catch {
      // non-fatal
    }
  }, []);

  const loadCreatorsForPicker = useCallback(async (api) => {
    const mergedMap = new Map();
    try {
      const resAdminCreators = await api.get("/users/creators/");
      const list1 = extractList(resAdminCreators, [
        "creators",
        "users",
        "results",
        "data",
      ]);
      list1.forEach((item) => {
        const norm = normalizeCreatorOption(item);
        if (norm && !mergedMap.has(norm.id)) {
          mergedMap.set(norm.id, norm);
        }
      });
    } catch {
      // fallback below
    }

    if (mergedMap.size === 0) {
      try {
        const resPublicCreators = await api.get("/creators/?page=1");
        const list2 = extractList(resPublicCreators, [
          "creators",
          "results",
          "data",
        ]);
        list2.forEach((item) => {
          const norm = normalizeCreatorOption(item);
          if (norm && !mergedMap.has(norm.id)) {
            mergedMap.set(norm.id, norm);
          }
        });
      } catch {
        // ignore
      }
    }

    setCreators(
      Array.from(mergedMap.values()).sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
  }, []);

  const fetchCampaigns = useCallback(
    async (isSilent = false) => {
      if (isSilent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const api = getAxiosInstance();
      try {
        const [campaignsRes] = await Promise.all([
          api.get("/campaigns/"),
          loadCreatorsForPicker(api),
          loadRecipesForPicker(api),
        ]);

        const list = extractList(campaignsRes, [
          "campaigns",
          "results",
          "data",
        ]);
        setCampaignsRaw(list);

        // Fetch attributed users per campaign (`GET /api/campaigns/{id}/users/`) so day/week/month signup filters are 100% accurate
        const usersMap = new Map();
        await Promise.all(
          list.map(async (c) => {
            if (!c?.id) return;
            try {
              const uRes = await api.get(`/campaigns/${c.id}/users/`);
              const rawUsers = extractList(uRes, [
                "users",
                "signups",
                "results",
                "data",
              ]);
              const normUsers = rawUsers
                .map((u, idx) => normalizeCampaignUser(u, idx))
                .filter(Boolean);
              usersMap.set(Number(c.id), normUsers);
            } catch {
              // ignore individual campaign user fetch failure
            }
          })
        );
        setUsersByCampaign(usersMap);
      } catch (err) {
        const msg =
          err?.response?.data?.message ||
          err?.response?.data?.detail ||
          "Unable to load campaigns.";
        showToast("error", msg);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [loadCreatorsForPicker, loadRecipesForPicker, showToast]
  );

  useEffect(() => {
    fetchCampaigns(false);
  }, [fetchCampaigns]);

  const creatorsMap = useMemo(() => {
    const m = new Map();
    creators.forEach((c) => m.set(Number(c.id), c));
    return m;
  }, [creators]);

  const recipesMap = useMemo(() => {
    const m = new Map();
    recipesCatalog.forEach((r) => m.set(Number(r.id), r));
    return m;
  }, [recipesCatalog]);

  const campaigns = useMemo(() => {
    return campaignsRaw
      .map((item) =>
        normalizeCampaign(item, creatorsMap, recipesMap, usersByCampaign)
      )
      .filter(Boolean)
      .map((c) => {
        // Compute signups in the selected period (`today`, `week`, `month`, `custom`, `all`)
        if (periodFilter === "all") {
          return {
            ...c,
            period_signups_count: c.signups_count,
          };
        }
        const matchingUsers = (c.users_list || []).filter((u) =>
          isWithinPeriod(u.created_at, periodFilter, customFrom, customTo)
        );
        return {
          ...c,
          period_signups_count: matchingUsers.length,
        };
      });
  }, [
    campaignsRaw,
    creatorsMap,
    recipesMap,
    usersByCampaign,
    periodFilter,
    customFrom,
    customTo,
  ]);

  // Summary Ribbon Metrics
  const summaryStats = useMemo(() => {
    let totalSignupsAllTime = 0;
    let periodSignups = 0;
    const uniqueCreators = new Set();

    campaigns.forEach((c) => {
      totalSignupsAllTime += c.signups_count || 0;
      periodSignups += c.period_signups_count || 0;
      if (c.creator_id) {
        uniqueCreators.add(c.creator_id);
      } else if (c.creator_name) {
        uniqueCreators.add(c.creator_name);
      }
    });

    const activePeriodLabel =
      PERIOD_OPTIONS.find((p) => p.key === periodFilter)?.label || "All Time";

    return {
      totalCampaigns: campaigns.length,
      totalSignupsAllTime,
      periodSignups,
      activePeriodLabel,
      uniqueCreatorsCount: uniqueCreators.size,
    };
  }, [campaigns, periodFilter]);

  // Filtered Campaigns for Table
  const filteredCampaigns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return campaigns.filter((c) => {
      // When filtering by period (Today / This Week / This Month / Custom), keep campaigns created in that period OR that had signups in that period
      if (periodFilter !== "all") {
        const campaignCreatedInPeriod = isWithinPeriod(
          c.created_at,
          periodFilter,
          customFrom,
          customTo
        );
        const hasSignupsInPeriod = (c.period_signups_count || 0) > 0;
        if (!campaignCreatedInPeriod && !hasSignupsInPeriod) {
          return false;
        }
      }

      if (creatorFilter !== "all") {
        if (String(c.creator_id) !== String(creatorFilter)) return false;
      }

      if (!q) return true;
      const recipeNames = c.recipes.map((r) => r.name.toLowerCase()).join(" ");
      return (
        c.name.toLowerCase().includes(q) ||
        c.creator_name.toLowerCase().includes(q) ||
        c.discount_label.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        recipeNames.includes(q)
      );
    });
  }, [campaigns, periodFilter, customFrom, customTo, creatorFilter, searchQuery]);

  const filteredPickerRecipes = useMemo(() => {
    const q = recipeSearchQuery.trim().toLowerCase();
    const list = !q
      ? recipesCatalog
      : recipesCatalog.filter(
          (r) =>
            r.name.toLowerCase().includes(q) ||
            String(r.id).includes(q) ||
            (r.creator_name && r.creator_name.toLowerCase().includes(q))
        );
    return list.slice(0, 80);
  }, [recipesCatalog, recipeSearchQuery]);

  // Create / Edit Modal Handlers
  const handleOpenCreateModal = () => {
    setEditingCampaign(null);
    setFormName("");
    setFormCreatorId("");
    setFormDiscountLabel("");
    setFormDescription("");
    setFormRecipeIds([]);
    setRecipeSearchQuery("");
    setFormModalOpen(true);
  };

  const handleOpenEditModal = async (campaign) => {
    setEditingCampaign(campaign);
    setFormName(campaign.name || "");
    setFormCreatorId(
      campaign.creator_id !== null && campaign.creator_id !== undefined
        ? String(campaign.creator_id)
        : ""
    );
    setFormDiscountLabel(campaign.discount_label || "");
    setFormDescription(campaign.description || "");
    setFormRecipeIds(
      Array.isArray(campaign.recipe_ids) ? campaign.recipe_ids : []
    );
    setRecipeSearchQuery("");
    setFormModalOpen(true);

    try {
      const api = getAxiosInstance();
      const res = await api.get(`/campaigns/${campaign.id}/`);
      const freshObj = extractObject(res);
      if (freshObj) {
        const freshNorm = normalizeCampaign(
          freshObj,
          creatorsMap,
          recipesMap,
          usersByCampaign
        );
        if (freshNorm) {
          setFormName(freshNorm.name || campaign.name || "");
          setFormCreatorId(
            freshNorm.creator_id !== null && freshNorm.creator_id !== undefined
              ? String(freshNorm.creator_id)
              : ""
          );
          setFormDiscountLabel(freshNorm.discount_label || "");
          setFormDescription(freshNorm.description || "");
          if (freshNorm.recipe_ids.length > 0) {
            setFormRecipeIds(freshNorm.recipe_ids);
          }
        }
      }
    } catch {
      // keep existing row fields
    }
  };

  const toggleRecipeInForm = (recipeId) => {
    const numId = Number(recipeId);
    setFormRecipeIds((prev) =>
      prev.includes(numId)
        ? prev.filter((id) => id !== numId)
        : [...prev, numId]
    );
  };

  const handleSaveCampaign = async (e) => {
    e.preventDefault();
    const trimmedName = formName.trim();
    if (!trimmedName) {
      showToast("error", "Campaign name is required.");
      return;
    }

    const payload = {
      name: trimmedName,
      creator_id:
        formCreatorId !== "" && !Number.isNaN(Number(formCreatorId))
          ? Number(formCreatorId)
          : null,
      discount_label: formDiscountLabel.trim()
        ? formDiscountLabel.trim()
        : null,
      description: formDescription.trim() ? formDescription.trim() : null,
      recipe_ids: Array.from(new Set(formRecipeIds.map((id) => Number(id)))),
    };

    setSubmittingForm(true);
    const api = getAxiosInstance();
    try {
      if (editingCampaign) {
        await api.patch(`/campaigns/${editingCampaign.id}/`, payload);
        showToast("success", `Campaign "${trimmedName}" updated.`);
      } else {
        await api.post("/campaigns/", payload);
        showToast("success", `Campaign "${trimmedName}" created.`);
      }
      setFormModalOpen(false);
      await fetchCampaigns(true);
    } catch (err) {
      const errData = err?.response?.data;
      const errMsg =
        errData?.message || errData?.detail || "Failed to save campaign.";
      showToast("error", errMsg);
    } finally {
      setSubmittingForm(false);
    }
  };

  // Open Campaign Details & Attributed Users Modal (`GET /api/campaigns/{id}/` + `GET /api/campaigns/{id}/users/`)
  const handleOpenCampaignUsers = async (campaign) => {
    setSelectedCampaign(campaign);
    setCampaignUsers(campaign.users_list || []);
    setModalPeriodFilter(periodFilter === "custom" ? "all" : periodFilter);
    setUserSearchQuery("");
    setDetailsModalOpen(true);
    setLoadingUsers(true);

    const api = getAxiosInstance();
    try {
      const [detailRes, usersRes] = await Promise.allSettled([
        api.get(`/campaigns/${campaign.id}/`),
        api.get(`/campaigns/${campaign.id}/users/`),
      ]);

      if (detailRes.status === "fulfilled") {
        const detailObj = extractObject(detailRes.value);
        if (detailObj) {
          const norm = normalizeCampaign(
            detailObj,
            creatorsMap,
            recipesMap,
            usersByCampaign
          );
          if (norm) {
            setSelectedCampaign((prev) => ({
              ...prev,
              ...norm,
              signups_count: norm.signups_count || prev?.signups_count || 0,
            }));
          }
        }
      }

      if (usersRes.status === "fulfilled") {
        const rawUsers = extractList(usersRes.value, [
          "users",
          "signups",
          "results",
          "data",
        ]);
        const normalizedUsers = rawUsers
          .map((u, idx) => normalizeCampaignUser(u, idx))
          .filter(Boolean);
        setCampaignUsers(normalizedUsers);
      }
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredModalUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return campaignUsers.filter((u) => {
      if (!isWithinPeriod(u.created_at, modalPeriodFilter, "", "")) {
        return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    });
  }, [campaignUsers, modalPeriodFilter, userSearchQuery]);

  const handleExportUsersCsv = () => {
    if (!selectedCampaign || filteredModalUsers.length === 0) return;
    const headers = ["User ID", "Name", "Email", "Joined Date", "Last Login"];
    const rows = filteredModalUsers.map((u) => [
      u.id,
      `"${String(u.name || "").replace(/"/g, '""')}"`,
      `"${String(u.email || "").replace(/"/g, '""')}"`,
      u.created_at || "",
      u.last_login || "",
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `campaign_${selectedCampaign.id}_signups.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const api = getAxiosInstance();
    try {
      await api.delete(`/campaigns/${deleteTarget.id}/`);
      showToast("success", `Campaign "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await fetchCampaigns(true);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        "Failed to delete campaign.";
      showToast("error", msg);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="cmp-page">
      {/* ── Page Header ── */}
      <header className="cmp-header">
        <div>
          <h1 className="cmp-title">Promotional Campaigns</h1>
          <p className="cmp-subtitle">
            Track creator referral campaigns, discount offers, and attributed user registrations.
          </p>
        </div>

        <div className="cmp-header-actions">
          <button
            type="button"
            className="cmp-refresh-btn"
            onClick={() => fetchCampaigns(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              size={14}
              className={loading || refreshing ? "cmp-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            className="cmp-primary-btn"
            onClick={handleOpenCreateModal}
          >
            <Plus size={15} />
            New Campaign
          </button>
        </div>
      </header>

      {/* ── Toast Notification ── */}
      {toast && (
        <div
          className={`cmp-toast ${
            toast.type === "error" ? "cmp-toast-error" : "cmp-toast-success"
          }`}
          role="status"
        >
          <div className="cmp-toast-left">
            {toast.type === "error" ? (
              <AlertCircle size={15} />
            ) : (
              <CheckCircle2 size={15} />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            className="cmp-toast-close"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Clean 4-Column Summary Strip (No Cluttered Badges) ── */}
      <section className="cmp-summary-ribbon" aria-label="Campaign metrics">
        <div className="cmp-summary-cell">
          <span className="cmp-summary-label">Total Campaigns</span>
          <div className="cmp-summary-val">
            {loading ? "—" : summaryStats.totalCampaigns.toLocaleString()}
          </div>
          <span className="cmp-summary-meta">Configured campaigns</span>
        </div>

        <div className="cmp-summary-cell">
          <span className="cmp-summary-label">Total Signups (All Time)</span>
          <div className="cmp-summary-val">
            {loading ? "—" : summaryStats.totalSignupsAllTime.toLocaleString()}
          </div>
          <span className="cmp-summary-meta">Lifetime attributed users</span>
        </div>

        <div className="cmp-summary-cell">
          <span className="cmp-summary-label">
            Signups ({summaryStats.activePeriodLabel})
          </span>
          <div className="cmp-summary-val">
            {loading ? "—" : summaryStats.periodSignups.toLocaleString()}
          </div>
          <span className="cmp-summary-meta">Filtered by selected period</span>
        </div>

        <div className="cmp-summary-cell">
          <span className="cmp-summary-label">Active Creators</span>
          <div className="cmp-summary-val">
            {loading ? "—" : summaryStats.uniqueCreatorsCount.toLocaleString()}
          </div>
          <span className="cmp-summary-meta">Creators with campaigns</span>
        </div>
      </section>

      {/* ── Main Campaigns Workbench ── */}
      <section className="cmp-workbench">
        <div className="cmp-toolbar">
          <div className="cmp-toolbar-left">
            {/* Period Filter: All Time | Today | This Week | This Month | Custom */}
            <div className="cmp-period-group" role="tablist">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`cmp-period-btn ${
                    periodFilter === opt.key ? "active" : ""
                  }`}
                  onClick={() => setPeriodFilter(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {periodFilter === "custom" && (
              <div className="cmp-custom-dates">
                <input
                  type="date"
                  className="cmp-date-input"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  aria-label="Start date"
                />
                <span className="cmp-date-sep">to</span>
                <input
                  type="date"
                  className="cmp-date-input"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  aria-label="End date"
                />
              </div>
            )}
          </div>

          <div className="cmp-toolbar-right">
            <select
              className="cmp-select-control"
              value={creatorFilter}
              onChange={(e) => setCreatorFilter(e.target.value)}
              aria-label="Filter by creator"
            >
              <option value="all">All Creators</option>
              {creators.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="cmp-search-wrap">
              <Search size={14} className="cmp-search-icon" />
              <input
                type="text"
                className="cmp-search-input"
                placeholder="Search campaign or creator..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  className="cmp-search-clear"
                  onClick={() => setSearchQuery("")}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ── Table / Empty / Loading States ── */}
        {loading ? (
          <div className="cmp-table-wrap">
            <table className="cmp-table">
              <thead>
                <tr>
                  <th className="cmp-col-campaign">Campaign</th>
                  <th className="cmp-col-creator">Creator</th>
                  <th className="cmp-col-discount">Offer</th>
                  <th className="cmp-col-recipes">Recipes</th>
                  <th className="cmp-col-signups">Signups</th>
                  <th className="cmp-col-date">Created</th>
                  <th className="cmp-col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((n) => (
                  <tr key={n}>
                    <td>
                      <div className="cmp-skeleton-bar" style={{ width: "75%" }} />
                    </td>
                    <td>
                      <div className="cmp-skeleton-bar" style={{ width: "65%" }} />
                    </td>
                    <td>
                      <div className="cmp-skeleton-bar" style={{ width: "55%" }} />
                    </td>
                    <td>
                      <div className="cmp-skeleton-bar" style={{ width: "50%" }} />
                    </td>
                    <td>
                      <div className="cmp-skeleton-bar" style={{ width: "45%" }} />
                    </td>
                    <td>
                      <div className="cmp-skeleton-bar" style={{ width: "65%" }} />
                    </td>
                    <td>
                      <div
                        className="cmp-skeleton-bar"
                        style={{ width: "80px", marginLeft: "auto" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="cmp-empty-state">
            <div className="cmp-empty-icon">
              <Tag size={18} />
            </div>
            <h3 className="cmp-empty-title">No campaigns found</h3>
            <p className="cmp-empty-sub">
              {campaigns.length === 0
                ? "Create your first promotional campaign to track creator signups."
                : "No campaigns match your selected time period or filter."}
            </p>
            {campaigns.length === 0 ? (
              <button
                type="button"
                className="cmp-primary-btn"
                onClick={handleOpenCreateModal}
              >
                <Plus size={14} />
                New Campaign
              </button>
            ) : (
              <button
                type="button"
                className="cmp-refresh-btn"
                onClick={() => {
                  setPeriodFilter("all");
                  setCreatorFilter("all");
                  setSearchQuery("");
                }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* ── Clean Desktop Table (Fits 100% Width, Zero Horizontal Scroll) ── */}
            <div className="cmp-table-wrap">
              <table className="cmp-table">
                <thead>
                  <tr>
                    <th className="cmp-col-campaign">Campaign</th>
                    <th className="cmp-col-creator">Creator</th>
                    <th className="cmp-col-discount">Offer</th>
                    <th className="cmp-col-recipes">Recipes</th>
                    <th className="cmp-col-signups">
                      {periodFilter === "all" ? "Signups" : "Period Signups"}
                    </th>
                    <th className="cmp-col-date">Created</th>
                    <th className="cmp-col-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((cmp) => {
                    const displaySignups =
                      periodFilter === "all"
                        ? cmp.signups_count
                        : cmp.period_signups_count;

                    return (
                      <tr key={cmp.id}>
                        <td className="cmp-col-campaign">
                          <span
                            className="cmp-name-link"
                            onClick={() => handleOpenCampaignUsers(cmp)}
                            title={cmp.name}
                          >
                            {cmp.name}
                          </span>
                        </td>

                        <td className="cmp-col-creator">
                          {cmp.creator_name ? (
                            <span
                              className="cmp-creator-text"
                              title={cmp.creator_name}
                            >
                              {cmp.creator_name}
                            </span>
                          ) : (
                            <span className="cmp-muted-text">Platform</span>
                          )}
                        </td>

                        <td className="cmp-col-discount">
                          {cmp.discount_label ? (
                            <span className="cmp-badge cmp-badge-amber">
                              {cmp.discount_label}
                            </span>
                          ) : (
                            <span className="cmp-muted-text">—</span>
                          )}
                        </td>

                        <td className="cmp-col-recipes">
                          <span style={{ color: "#475569", fontWeight: 500 }}>
                            {cmp.recipes_count}{" "}
                            {cmp.recipes_count === 1 ? "recipe" : "recipes"}
                          </span>
                        </td>

                        <td className="cmp-col-signups">
                          <button
                            type="button"
                            className={`cmp-signup-count-btn ${
                              displaySignups > 0 ? "active-count" : ""
                            }`}
                            onClick={() => handleOpenCampaignUsers(cmp)}
                            title="View attributed users"
                          >
                            {displaySignups.toLocaleString()}
                            {periodFilter !== "all" && (
                              <span
                                style={{
                                  fontWeight: 500,
                                  color: "#64748b",
                                  fontSize: "0.72rem",
                                }}
                              >
                                / {cmp.signups_count}
                              </span>
                            )}
                          </button>
                        </td>

                        <td className="cmp-col-date">
                          <span style={{ color: "#475569", fontSize: "0.8rem" }}>
                            {formatShortDate(cmp.created_at)}
                          </span>
                        </td>

                        <td className="cmp-col-actions">
                          <div className="cmp-row-actions">
                            <button
                              type="button"
                              className="cmp-action-btn"
                              onClick={() => handleOpenCampaignUsers(cmp)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="cmp-icon-btn"
                              onClick={() => handleOpenEditModal(cmp)}
                              title="Edit campaign"
                              aria-label={`Edit ${cmp.name}`}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              className="cmp-icon-btn cmp-icon-btn-danger"
                              onClick={() => setDeleteTarget(cmp)}
                              title="Delete campaign"
                              aria-label={`Delete ${cmp.name}`}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── Mobile Responsive Cards ── */}
            <div className="cmp-mobile-list">
              {filteredCampaigns.map((cmp) => {
                const displaySignups =
                  periodFilter === "all"
                    ? cmp.signups_count
                    : cmp.period_signups_count;

                return (
                  <div key={cmp.id} className="cmp-mobile-card">
                    <div className="cmp-mobile-top">
                      <span
                        className="cmp-mobile-title"
                        onClick={() => handleOpenCampaignUsers(cmp)}
                      >
                        {cmp.name}
                      </span>
                      {cmp.discount_label ? (
                        <span className="cmp-badge cmp-badge-amber">
                          {cmp.discount_label}
                        </span>
                      ) : null}
                    </div>

                    <div className="cmp-mobile-kv-grid">
                      <div className="cmp-mobile-kv">
                        <span className="cmp-mobile-kv-label">Creator</span>
                        <span className="cmp-mobile-kv-val">
                          {cmp.creator_name || "Platform"}
                        </span>
                      </div>
                      <div className="cmp-mobile-kv">
                        <span className="cmp-mobile-kv-label">Signups</span>
                        <span className="cmp-mobile-kv-val">
                          {displaySignups.toLocaleString()} users
                        </span>
                      </div>
                      <div className="cmp-mobile-kv">
                        <span className="cmp-mobile-kv-label">Recipes</span>
                        <span className="cmp-mobile-kv-val">
                          {cmp.recipes_count} linked
                        </span>
                      </div>
                      <div className="cmp-mobile-kv">
                        <span className="cmp-mobile-kv-label">Created</span>
                        <span className="cmp-mobile-kv-val">
                          {formatShortDate(cmp.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="cmp-mobile-actions">
                      <button
                        type="button"
                        className="cmp-action-btn"
                        onClick={() => handleOpenCampaignUsers(cmp)}
                      >
                        View Signups ({displaySignups})
                      </button>
                      <button
                        type="button"
                        className="cmp-action-btn"
                        onClick={() => handleOpenEditModal(cmp)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="cmp-icon-btn cmp-icon-btn-danger"
                        onClick={() => setDeleteTarget(cmp)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Create / Edit Campaign Modal (`CampaignWrite`) ── */}
      {formModalOpen && (
        <div
          className="cmp-modal-backdrop"
          onClick={() => !submittingForm && setFormModalOpen(false)}
        >
          <div
            className="cmp-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cmp-modal-header">
              <h2 className="cmp-modal-title">
                {editingCampaign ? "Edit Campaign" : "New Promotional Campaign"}
              </h2>
              <button
                type="button"
                className="cmp-modal-close"
                onClick={() => !submittingForm && setFormModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleSaveCampaign}>
              <div className="cmp-modal-body">
                <div className="cmp-form-grid-2">
                  <div className="cmp-field">
                    <label className="cmp-label" htmlFor="cmp-name-input">
                      <span>
                        Campaign Name<span className="cmp-label-req">*</span>
                      </span>
                    </label>
                    <input
                      id="cmp-name-input"
                      type="text"
                      className="cmp-input"
                      placeholder="e.g. Amadeo Business Summit Offer"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="cmp-field">
                    <label className="cmp-label" htmlFor="cmp-creator-select">
                      <span>Linked Creator</span>
                      <span className="cmp-label-hint">Optional</span>
                    </label>
                    <select
                      id="cmp-creator-select"
                      className="cmp-select"
                      value={formCreatorId}
                      onChange={(e) => setFormCreatorId(e.target.value)}
                    >
                      <option value="">Platform Campaign (No creator)</option>
                      {creators.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="cmp-field">
                  <label className="cmp-label" htmlFor="cmp-discount-input">
                    <span>Discount Label</span>
                    <span className="cmp-label-hint">Optional</span>
                  </label>
                  <input
                    id="cmp-discount-input"
                    type="text"
                    className="cmp-input"
                    maxLength={255}
                    placeholder="e.g. 50% OFF"
                    value={formDiscountLabel}
                    onChange={(e) => setFormDiscountLabel(e.target.value)}
                  />
                  <div className="cmp-preset-chips">
                    {DISCOUNT_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className="cmp-preset-chip"
                        onClick={() => setFormDiscountLabel(preset)}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cmp-field">
                  <label className="cmp-label" htmlFor="cmp-desc-textarea">
                    <span>Description</span>
                    <span className="cmp-label-hint">Optional</span>
                  </label>
                  <textarea
                    id="cmp-desc-textarea"
                    className="cmp-textarea"
                    placeholder="Campaign summary or offer notes..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                  />
                </div>

                <div className="cmp-field">
                  <div className="cmp-label">
                    <span>Curated Recipes</span>
                    <span className="cmp-label-hint">
                      {formRecipeIds.length} selected
                    </span>
                  </div>

                  <div className="cmp-recipe-picker-box">
                    <div className="cmp-recipe-picker-top">
                      <input
                        type="text"
                        className="cmp-recipe-picker-search"
                        placeholder="Search recipes by name..."
                        value={recipeSearchQuery}
                        onChange={(e) => setRecipeSearchQuery(e.target.value)}
                      />
                      {formRecipeIds.length > 0 && (
                        <button
                          type="button"
                          className="cmp-copy-inline-btn"
                          onClick={() => setFormRecipeIds([])}
                        >
                          Clear
                        </button>
                      )}
                    </div>

                    {formRecipeIds.length > 0 && (
                      <div className="cmp-selected-recipes-bar">
                        {formRecipeIds.map((id) => {
                          const r = recipesMap.get(Number(id));
                          return (
                            <span
                              key={id}
                              className="cmp-selected-recipe-chip"
                            >
                              {r ? r.name : `Recipe #${id}`}
                              <button
                                type="button"
                                className="cmp-selected-recipe-remove"
                                onClick={() => toggleRecipeInForm(id)}
                              >
                                <X size={11} />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}

                    <div className="cmp-recipe-picker-list">
                      {filteredPickerRecipes.map((r) => {
                        const isSelected = formRecipeIds.includes(Number(r.id));
                        return (
                          <div
                            key={r.id}
                            className={`cmp-recipe-option ${
                              isSelected ? "selected" : ""
                            }`}
                            onClick={() => toggleRecipeInForm(r.id)}
                          >
                            <div className="cmp-recipe-option-left">
                              <span className="cmp-recipe-check">
                                {isSelected && <Check size={10} />}
                              </span>
                              <span className="cmp-recipe-option-title">
                                {r.name}
                              </span>
                            </div>
                            <span className="cmp-recipe-option-meta">
                              {r.creator_name || `#${r.id}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="cmp-modal-footer">
                <button
                  type="button"
                  className="cmp-refresh-btn"
                  onClick={() => setFormModalOpen(false)}
                  disabled={submittingForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cmp-primary-btn"
                  disabled={submittingForm}
                >
                  {submittingForm
                    ? "Saving..."
                    : editingCampaign
                    ? "Save Changes"
                    : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Campaign Details & Signups Modal (`GET /api/campaigns/{id}/users/`) ── */}
      {detailsModalOpen && selectedCampaign && (
        <div
          className="cmp-modal-backdrop"
          onClick={() => setDetailsModalOpen(false)}
        >
          <div
            className="cmp-modal cmp-modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cmp-modal-header">
              <h2 className="cmp-modal-title">Campaign Overview & Signups</h2>
              <button
                type="button"
                className="cmp-modal-close"
                onClick={() => setDetailsModalOpen(false)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="cmp-modal-body">
              <div className="cmp-receipt-box">
                <div className="cmp-receipt-hero">
                  <div>
                    <span className="cmp-receipt-eyebrow">
                      Campaign #{selectedCampaign.id}
                    </span>
                    <div className="cmp-receipt-title">
                      {selectedCampaign.name}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {selectedCampaign.discount_label && (
                      <span className="cmp-badge cmp-badge-amber">
                        {selectedCampaign.discount_label}
                      </span>
                    )}
                    <span className="cmp-badge cmp-badge-emerald">
                      {selectedCampaign.signups_count.toLocaleString()} Total Signups
                    </span>
                    <button
                      type="button"
                      className="cmp-copy-inline-btn"
                      onClick={() =>
                        handleCopyText(
                          String(selectedCampaign.id),
                          "campaign-id"
                        )
                      }
                    >
                      {copiedKey === "campaign-id" ? (
                        <>
                          <Check size={11} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          ID #{selectedCampaign.id}
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="cmp-receipt-kv-list">
                  <div className="cmp-receipt-kv-item">
                    <span className="cmp-receipt-kv-label">Creator</span>
                    <span className="cmp-receipt-kv-val">
                      {selectedCampaign.creator_name || "Platform Campaign"}
                    </span>
                  </div>

                  <div className="cmp-receipt-kv-item">
                    <span className="cmp-receipt-kv-label">Created Date</span>
                    <span className="cmp-receipt-kv-val">
                      {formatShortDate(selectedCampaign.created_at)}
                    </span>
                  </div>

                  {selectedCampaign.description && (
                    <div className="cmp-receipt-kv-item full-width">
                      <span className="cmp-receipt-kv-label">Description</span>
                      <span className="cmp-receipt-kv-val">
                        {selectedCampaign.description}
                      </span>
                    </div>
                  )}

                  {selectedCampaign.recipes.length > 0 && (
                    <div className="cmp-receipt-kv-item full-width">
                      <span className="cmp-receipt-kv-label">
                        Curated Recipes ({selectedCampaign.recipes.length})
                      </span>
                      <div className="cmp-receipt-recipes-wrap">
                        {selectedCampaign.recipes.map((r) => (
                          <span key={r.id} className="cmp-receipt-recipe-pill">
                            {r.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Attributed Users Filter Bar (Day / Week / Month / Search / Export) */}
              <div className="cmp-users-section-header">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h3 className="cmp-users-section-title">
                    Attributed Users ({filteredModalUsers.length})
                  </h3>

                  <div className="cmp-period-group">
                    {[
                      { key: "all", label: "All Time" },
                      { key: "today", label: "Today" },
                      { key: "week", label: "This Week" },
                      { key: "month", label: "This Month" },
                    ].map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        className={`cmp-period-btn ${
                          modalPeriodFilter === p.key ? "active" : ""
                        }`}
                        onClick={() => setModalPeriodFilter(p.key)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {campaignUsers.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <input
                      type="text"
                      className="cmp-recipe-picker-search"
                      style={{ width: "190px" }}
                      placeholder="Search name or email..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                    <button
                      type="button"
                      className="cmp-action-btn"
                      onClick={handleExportUsersCsv}
                    >
                      <Download size={12} />
                      CSV
                    </button>
                  </div>
                )}
              </div>

              <div className="cmp-users-table-box">
                {loadingUsers ? (
                  <div
                    style={{
                      padding: "26px",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      color: "#64748b",
                    }}
                  >
                    Loading attributed users...
                  </div>
                ) : filteredModalUsers.length === 0 ? (
                  <div
                    style={{
                      padding: "28px 20px",
                      textAlign: "center",
                      fontSize: "0.82rem",
                      color: "#64748b",
                    }}
                  >
                    {campaignUsers.length === 0
                      ? "No users have registered through this campaign yet."
                      : "No user registrations match the selected time period or search."}
                  </div>
                ) : (
                  <div>
                    {filteredModalUsers.map((u) => (
                      <div key={u.id} className="cmp-user-row">
                        <div className="cmp-user-main">
                          <span className="cmp-user-name">{u.name}</span>
                          <div className="cmp-user-email-line">
                            <span>{u.email}</span>
                            {u.email && u.email !== "—" && (
                              <button
                                type="button"
                                className="cmp-copy-inline-btn"
                                onClick={() =>
                                  handleCopyText(u.email, `u-${u.id}`)
                                }
                              >
                                {copiedKey === `u-${u.id}` ? (
                                  <Check size={10} />
                                ) : (
                                  <Copy size={10} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="cmp-user-dates">
                          <span className="cmp-user-joined">
                            Joined {formatShortDate(u.created_at)}
                          </span>
                          {u.last_login && (
                            <span className="cmp-user-login">
                              Last login {formatShortDate(u.last_login)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="cmp-modal-footer">
              <button
                type="button"
                className="cmp-refresh-btn"
                onClick={() => {
                  const target = selectedCampaign;
                  setDetailsModalOpen(false);
                  handleOpenEditModal(target);
                }}
              >
                Edit Campaign
              </button>
              <button
                type="button"
                className="cmp-primary-btn"
                onClick={() => setDetailsModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div
          className="cmp-modal-backdrop"
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className="cmp-modal cmp-modal-sm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="cmp-modal-header">
              <h2 className="cmp-modal-title">Delete Campaign</h2>
              <button
                type="button"
                className="cmp-modal-close"
                onClick={() => !deleting && setDeleteTarget(null)}
              >
                <X size={15} />
              </button>
            </div>

            <div className="cmp-modal-body">
              <div className="cmp-receipt-box">
                <div className="cmp-receipt-kv-list">
                  <div className="cmp-receipt-kv-item full-width">
                    <span className="cmp-receipt-kv-label">Campaign</span>
                    <span className="cmp-receipt-kv-val">
                      {deleteTarget.name}
                    </span>
                  </div>
                </div>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "0.82rem",
                  color: "#475569",
                  lineHeight: 1.5,
                }}
              >
                Are you sure you want to delete this campaign? Attributed user accounts will not be affected.
              </p>
            </div>

            <div className="cmp-modal-footer">
              <button
                type="button"
                className="cmp-refresh-btn"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cmp-primary-btn"
                style={{ background: "#dc2626", borderColor: "#dc2626" }}
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
