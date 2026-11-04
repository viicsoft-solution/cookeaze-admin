import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Users,
  FileCheck2,
  ShieldAlert,
  ShieldCheck,
  Eye,
  BookOpen,
  LayoutGrid,
  List as ListIcon,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./Creators.css";

const BANNED_STORAGE_KEY = "cookeaze_banned_creators_v1";
const KNOWN_CREATOR_IDS_KEY = "cookeaze_known_creator_ids_v1";

const DEFAULT_KNOWN_CREATORS_BY_NAME = {
  chefchima: 14,
  perpetual: 801,
  "zara's kitchen": 772,
  "chef uche": 25,
  valeria: 823,
  "nwakudu angel amarachi": 836,
  "chef vivian": 866,
  lydia: 876,
};

function extractArray(resOrData) {
  const root = resOrData?.data !== undefined ? resOrData.data : resOrData;
  if (!root) return [];
  if (Array.isArray(root)) return root;
  if (Array.isArray(root.data)) return root.data;
  if (Array.isArray(root.results)) return root.results;
  if (Array.isArray(root.users)) return root.users;
  if (root.data && typeof root.data === "object") {
    if (Array.isArray(root.data.results)) return root.data.results;
    if (Array.isArray(root.data.data)) return root.data.data;
    if (Array.isArray(root.data.users)) return root.data.users;
  }
  return [];
}

function loadKnownCreatorIdsByName() {
  try {
    const raw = localStorage.getItem(KNOWN_CREATOR_IDS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return {
      ...DEFAULT_KNOWN_CREATORS_BY_NAME,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch {
    return { ...DEFAULT_KNOWN_CREATORS_BY_NAME };
  }
}

function rememberCreatorIds(creatorsList) {
  if (!Array.isArray(creatorsList)) return;
  try {
    const map = loadKnownCreatorIdsByName();
    creatorsList.forEach((c) => {
      if (c && c.id && c.creator_name) {
        map[String(c.creator_name).trim().toLowerCase()] = Number(c.id);
      }
    });
    localStorage.setItem(KNOWN_CREATOR_IDS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
}

const BAN_REASON_PRESETS = [
  "Violation of community recipe guidelines",
  "Repeated copyright or stolen food photography",
  "Spam or misleading culinary content",
  "Account security / impersonation concern",
];

const REJECT_REASON_PRESETS = [
  "Government ID photo is blurry or unreadable",
  "Incomplete culinary portfolio or social verification",
  "Profile details do not match submitted identity document",
];

function getInitials(name) {
  const clean = String(name || "Creator").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "CR";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function loadStoredBannedCreators() {
  try {
    const raw = localStorage.getItem(BANNED_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveBannedCreatorRecord(creator, reason = "") {
  if (!creator || !creator.id) return;
  try {
    const current = loadStoredBannedCreators();
    current[String(creator.id)] = {
      id: creator.id,
      creator_name: creator.creator_name || "Creator",
      profile_picture_url: creator.profile_picture_url || null,
      total_recipes: creator.total_recipes ?? 0,
      description: creator.description || creator.bio || "",
      ban_reason: reason || "",
      is_banned: true,
    };
    localStorage.setItem(BANNED_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

export function removeBannedCreatorRecord(userId) {
  if (!userId) return;
  try {
    const current = loadStoredBannedCreators();
    delete current[String(userId)];
    localStorage.setItem(BANNED_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // ignore storage errors
  }
}

/**
 * Safely normalize `social_media` whether the backend returns a single URL string,
 * a JSON-encoded object/array string, an array of URLs, or an object map.
 */
function parseSocialLinks(rawSocial) {
  if (!rawSocial) return [];

  if (typeof rawSocial === "string") {
    const trimmed = rawSocial.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseSocialLinks(parsed);
      } catch {
        // treat as plain string URL
      }
    }

    const href = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return [{ label: "Open Social Profile", url: href, display: trimmed }];
  }

  if (Array.isArray(rawSocial)) {
    return rawSocial
      .filter((item) => typeof item === "string" && item.trim())
      .map((item, idx) => {
        const trimmed = item.trim();
        const href = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        return {
          label: `Social Link ${idx + 1}`,
          url: href,
          display: trimmed,
        };
      });
  }

  if (typeof rawSocial === "object") {
    return Object.entries(rawSocial)
      .filter(([, val]) => typeof val === "string" && val.trim())
      .map(([platform, val]) => {
        const trimmed = val.trim();
        const href = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        return {
          label: platform.charAt(0).toUpperCase() + platform.slice(1),
          url: href,
          display: trimmed,
        };
      });
  }

  return [];
}

/**
 * Normalize image fields (`gov_id_images` or `media_file`) whether the backend
 * returns a single URL string or an array of URL strings.
 */
function normalizeUrlList(rawField) {
  if (!rawField) return [];
  if (typeof rawField === "string") {
    const trimmed = rawField.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(rawField)) {
    return rawField
      .filter((item) => typeof item === "string" && item.trim())
      .map((item) => item.trim());
  }
  return [];
}

export default function CreatorsPage() {
  const navigate = useNavigate();
  const api = useMemo(() => getAxiosInstance(), []);

  // Primary navigation tab
  const [activeTab, setActiveTab] = useState("approved"); // "approved" | "applications" | "my-status"
  const [toast, setToast] = useState(null);

  // Approved Creators state
  const [creators, setCreators] = useState([]);
  const [activeCreatorsCount, setActiveCreatorsCount] = useState(0);
  const [bannedCreatorsCount, setBannedCreatorsCount] = useState(0);
  const [creatorsLoading, setCreatorsLoading] = useState(false);
  const [creatorSearch, setCreatorSearch] = useState("");
  const [creatorPage, setCreatorPage] = useState(1);
  const [creatorTotalPages, setCreatorTotalPages] = useState(1);
  const [creatorFilter, setCreatorFilter] = useState("active"); // "active" | "banned"
  const [creatorViewMode, setCreatorViewMode] = useState("grid");
  const [brokenAvatars, setBrokenAvatars] = useState({});

  // Ban / Unban modal state
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [banActionLoading, setBanActionLoading] = useState(false);

  // Creator Applications state
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appStatusFilter, setAppStatusFilter] = useState("pending"); // "pending" | "approved" | "rejected"
  const [appSearch, setAppSearch] = useState("");

  // Application Review modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [appDetailLoading, setAppDetailLoading] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [decisionLoading, setDecisionLoading] = useState(false);

  const showToast = useCallback((type, message) => {
    setToast({ type, message });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  /**
   * Discover all Banned Creators reliably:
   * Because `GET /api/creators/` on the backend filters `is_banned=False` (even when
   * `?is_banned=true` is passed), we combine:
   * 1. Any creator explicitly returned with `is_banned: true` or outside the active set.
   * 2. Approved creators from `GET /creator/apply/admin/?status=approved` who are NOT in
   *    the active `GET /creators/` list, matched with `GET /users/` by email/name to get
   *    their exact `user_id` for `POST /users/<user_id>/ban-creator/` (`{ action: "unban" }`).
   * 3. Any creator banned from this browser stored in `cookeaze_banned_creators_v1`.
   */
  const fetchBannedCreatorsList = useCallback(
    async (activeList, searchQuery = "") => {
      try {
        const safeActive = Array.isArray(activeList) ? activeList : [];
        rememberCreatorIds(safeActive);

        const activeIds = new Set(safeActive.map((c) => Number(c.id)));
        const activeNames = new Set(
          safeActive.map((c) =>
            String(c.creator_name || "")
              .trim()
              .toLowerCase()
          )
        );
        const knownIdsByName = loadKnownCreatorIdsByName();

        const bannedMap = new Map();

        // 1. Seed from localStorage registry (for any creator banned on this browser)
        const storedBanned = loadStoredBannedCreators();
        Object.values(storedBanned).forEach((item) => {
          if (item && item.id && !activeIds.has(Number(item.id))) {
            bannedMap.set(Number(item.id), { ...item, is_banned: true });
          } else if (item && item.id && activeIds.has(Number(item.id))) {
            removeBannedCreatorRecord(item.id);
          }
        });

        // 2. Query `/creators/?is_banned=true`, `/creator/apply/admin/?status=approved`, and `/users/` in parallel
        const [bannedEndpointRes, approvedAppsRes, usersRes] =
          await Promise.allSettled([
            api.get("/creators/", { params: { is_banned: true } }),
            api.get("/creator/apply/admin/", { params: { status: "approved" } }),
            api.get("/users/"),
          ]);

        // Check if `/creators/?is_banned=true` returned any creator not in `activeIds`
        if (bannedEndpointRes.status === "fulfilled") {
          const list = extractArray(bannedEndpointRes.value);
          list.forEach((c) => {
            if (
              c &&
              c.id &&
              (c.is_banned === true || !activeIds.has(Number(c.id)))
            ) {
              bannedMap.set(Number(c.id), {
                ...c,
                is_banned: true,
              });
            }
          });
        }

        // Cross-reference Approved Creator Applications + Users against Active Creators
        const usersList =
          usersRes.status === "fulfilled"
            ? extractArray(usersRes.value)
            : [];
        const usersByEmail = new Map();
        const usersById = new Map();
        const usersByFullName = new Map();

        usersList.forEach((u) => {
          if (!u || typeof u !== "object") return;
          if (u.id) usersById.set(Number(u.id), u);
          if (u.email) {
            usersByEmail.set(String(u.email).trim().toLowerCase(), u);
          }
          const fullName = `${u.first_name || ""} ${u.last_name || ""}`
            .trim()
            .toLowerCase();
          if (fullName) {
            usersByFullName.set(fullName, u);
          }
          if (u.is_banned === true && !activeIds.has(Number(u.id))) {
            bannedMap.set(Number(u.id), {
              id: u.id,
              creator_name:
                u.creator_name ||
                `${u.first_name || ""} ${u.last_name || ""}`.trim() ||
                u.email,
              profile_picture_url: u.profile_picture_url || null,
              total_recipes: u.total_recipes ?? 0,
              description: u.bio || u.description || "Banned Creator",
              is_banned: true,
            });
          }
        });

        if (approvedAppsRes.status === "fulfilled") {
          const approvedApps = extractArray(approvedAppsRes.value);
          approvedApps.forEach((app) => {
            if (!app || typeof app !== "object") return;
            const profName = String(app.professional_name || "").trim();
            const profLower = profName.toLowerCase();

            // If this approved creator is currently active in `/creators/`, they are NOT banned
            if (profLower && activeNames.has(profLower)) {
              return;
            }

            // Match to User account or known creator ID to get the exact `userId` for `/users/<userId>/ban-creator/`
            const emailKey = String(app.user_email || "")
              .trim()
              .toLowerCase();
            const fullNameKey = String(app.user_full_name || "")
              .trim()
              .toLowerCase();

            const matchedUser =
              (app.user_id && usersById.get(Number(app.user_id))) ||
              (typeof app.user === "number" &&
                usersById.get(Number(app.user))) ||
              (app.user?.id && usersById.get(Number(app.user.id))) ||
              (emailKey && usersByEmail.get(emailKey)) ||
              (fullNameKey && usersByFullName.get(fullNameKey)) ||
              null;

            const resolvedUserId =
              matchedUser?.id ||
              app.user_id ||
              (typeof app.user === "number" ? app.user : app.user?.id) ||
              (profLower && knownIdsByName[profLower]) ||
              null;

            if (!resolvedUserId || activeIds.has(Number(resolvedUserId))) {
              return;
            }

            const existing = bannedMap.get(Number(resolvedUserId));
            bannedMap.set(Number(resolvedUserId), {
              id: resolvedUserId,
              creator_name:
                profName ||
                existing?.creator_name ||
                app.user_full_name ||
                matchedUser?.first_name ||
                "Banned Creator",
              profile_picture_url:
                existing?.profile_picture_url ||
                matchedUser?.profile_picture_url ||
                null,
              total_recipes: existing?.total_recipes ?? 0,
              description:
                existing?.description ||
                app.bio ||
                (app.user_full_name
                  ? `${app.user_full_name} (${app.user_email || ""})`
                  : "Suspended Creator Account"),
              user_email: app.user_email || matchedUser?.email || "",
              is_banned: true,
            });
          });
        }

        let result = Array.from(bannedMap.values());
        const q = searchQuery.trim().toLowerCase();
        if (q) {
          result = result.filter(
            (c) =>
              String(c.creator_name || "")
                .toLowerCase()
                .includes(q) ||
              String(c.description || "")
                .toLowerCase()
                .includes(q) ||
              String(c.user_email || "")
                .toLowerCase()
                .includes(q)
          );
        }

        return result;
      } catch (err) {
        console.error("Failed to compute banned creators list:", err);
        return Object.values(loadStoredBannedCreators());
      }
    },
    [api]
  );

  // Fetch Approved Creators (Active or Banned)
  const fetchApprovedCreators = useCallback(async () => {
    setCreatorsLoading(true);
    try {
      const activeRes = await api.get("/creators/", {
        params: {
          search:
            creatorFilter === "active"
              ? creatorSearch.trim() || undefined
              : undefined,
          page: creatorFilter === "active" ? creatorPage : 1,
        },
      });

      const activeRaw = extractArray(activeRes);
      rememberCreatorIds(activeRaw);
      const activeDecorated = activeRaw.map((c) => ({
        ...c,
        is_banned: false,
      }));
      setActiveCreatorsCount(
        activeRes.data?.pagination?.count ?? activeDecorated.length
      );

      if (creatorFilter === "active") {
        setCreators(activeDecorated);
        setCreatorTotalPages(activeRes.data?.pagination?.total_pages || 1);
        // Also refresh banned count in background so badge is accurate
        fetchBannedCreatorsList(activeDecorated, "")
          .then((bannedList) => {
            setBannedCreatorsCount(bannedList.length);
          })
          .catch(() => {});
      } else {
        const bannedList = await fetchBannedCreatorsList(
          activeDecorated,
          creatorSearch
        );
        setBannedCreatorsCount(bannedList.length);
        setCreators(bannedList);
        setCreatorTotalPages(1);
      }
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to load creators."
      );
    } finally {
      setCreatorsLoading(false);
    }
  }, [
    api,
    creatorFilter,
    creatorPage,
    creatorSearch,
    fetchBannedCreatorsList,
    showToast,
  ]);

  // Fetch Applications
  const fetchApplications = useCallback(async () => {
    setAppsLoading(true);
    try {
      const res = await api.get("/creator/apply/admin/", {
        params: { status: appStatusFilter },
      });
      setApplications(extractArray(res));
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to load creator applications."
      );
    } finally {
      setAppsLoading(false);
    }
  }, [api, appStatusFilter, showToast]);

  useEffect(() => {
    if (activeTab === "approved") {
      fetchApprovedCreators();
    } else if (activeTab === "applications") {
      fetchApplications();
    }
  }, [activeTab, fetchApprovedCreators, fetchApplications]);

  // Filtered applications by search query
  const filteredApplications = useMemo(() => {
    const q = appSearch.trim().toLowerCase();
    if (!q) return applications;
    return applications.filter(
      (app) =>
        String(app.professional_name || "")
          .toLowerCase()
          .includes(q) ||
        String(app.user_full_name || "")
          .toLowerCase()
          .includes(q) ||
        String(app.user_email || "")
          .toLowerCase()
          .includes(q)
    );
  }, [applications, appSearch]);

  // Open Ban / Unban modal
  const openBanModal = (creator) => {
    const isBanned =
      creatorFilter === "banned" ? true : Boolean(creator.is_banned);
    setBanTarget({ ...creator, is_banned: isBanned });
    setBanReason("");
  };

  const handleConfirmBanToggle = async () => {
    if (!banTarget) return;
    const isUnban = Boolean(banTarget.is_banned);

    if (!isUnban && !banReason.trim()) {
      showToast("error", "Please enter or select a reason for banning.");
      return;
    }

    setBanActionLoading(true);
    try {
      const payload = {
        action: isUnban ? "unban" : "ban",
        ...(isUnban ? {} : { reason: banReason.trim() }),
      };

      const res = await api.post(`/users/${banTarget.id}/ban-creator/`, payload);
      if (
        res.data?.status === "success" ||
        res.data?.isSuccessful ||
        res.status === 200
      ) {
        if (isUnban) {
          removeBannedCreatorRecord(banTarget.id);
        } else {
          saveBannedCreatorRecord(banTarget, banReason.trim());
        }

        showToast(
          "success",
          isUnban
            ? `Unbanned "${banTarget.creator_name}" — their creator profile and recipes are now active again!`
            : `Banned "${banTarget.creator_name}". You can restore them anytime from the Banned Creators tab.`
        );
        setBanTarget(null);
        setBanReason("");
        fetchApprovedCreators();
      }
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message || "Failed to update creator status."
      );
    } finally {
      setBanActionLoading(false);
    }
  };

  // Open Application Review Modal
  const openApplicationReview = async (appId) => {
    setReviewModalOpen(true);
    setAppDetailLoading(true);
    setSelectedApp(null);
    setRejectionReason("");
    try {
      const res = await api.get(`/creator/apply/admin/${appId}/`);
      setSelectedApp(res.data?.data || null);
    } catch {
      showToast("error", "Could not load application details.");
      setReviewModalOpen(false);
    } finally {
      setAppDetailLoading(false);
    }
  };

  // Approve or Reject Application
  const handleApplicationDecision = async (actionType) => {
    if (!selectedApp) return;
    if (actionType === "reject" && !rejectionReason.trim()) {
      showToast("error", "Please provide a rejection reason for the applicant.");
      return;
    }

    setDecisionLoading(true);
    try {
      const payload = {
        action: actionType,
        ...(actionType === "reject"
          ? { rejection_reason: rejectionReason.trim() }
          : {}),
      };

      const res = await api.patch(
        `/creator/apply/admin/${selectedApp.id}/`,
        payload
      );
      if (
        res.data?.status === "success" ||
        res.data?.isSuccessful ||
        res.status === 200
      ) {
        showToast(
          "success",
          actionType === "approve"
            ? `Approved ${selectedApp.professional_name || "creator"}!`
            : `Rejected application for ${
                selectedApp.professional_name || "applicant"
              }.`
        );
        setReviewModalOpen(false);
        setSelectedApp(null);
        setRejectionReason("");
        fetchApplications();
      }
    } catch (err) {
      showToast(
        "error",
        err.response?.data?.message ||
          `Failed to ${actionType} creator application.`
      );
    } finally {
      setDecisionLoading(false);
    }
  };

  const renderTableAvatar = (creator) => {
    const url = creator?.profile_picture_url;
    const key = creator?.id || creator?.creator_name;
    if (url && !brokenAvatars[key]) {
      return (
        <img
          src={url}
          alt={creator.creator_name || "Creator"}
          className="cr-avatar"
          onError={() =>
            setBrokenAvatars((prev) => ({ ...prev, [key]: true }))
          }
        />
      );
    }
    return <div className="cr-avatar">{getInitials(creator?.creator_name)}</div>;
  };

  const selectedSocialLinks = useMemo(
    () => parseSocialLinks(selectedApp?.social_media),
    [selectedApp]
  );
  const selectedGovIdUrls = useMemo(
    () => normalizeUrlList(selectedApp?.gov_id_images),
    [selectedApp]
  );
  const selectedMediaUrls = useMemo(
    () => normalizeUrlList(selectedApp?.media_file),
    [selectedApp]
  );

  return (
    <div className="cr-page">
      {/* Header */}
      <div className="cr-header">
        <div className="cr-header-left">
          <h1 className="cr-title">Creators & Applications</h1>
          <p className="cr-subtitle">
            Manage verified recipe creators, review incoming chef applications, and moderate account standing.
          </p>
        </div>

        <div className="cr-header-actions">
          <button
            type="button"
            className="cr-btn cr-btn-secondary"
            onClick={() => {
              if (activeTab === "approved") fetchApprovedCreators();
              else fetchApplications();
            }}
          >
            <RefreshCw
              size={15}
              className={creatorsLoading || appsLoading ? "spin" : ""}
            />
            Refresh
          </button>
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

      {/* Primary Section Tabs */}
      <div className="cr-tabs-bar">
        <div className="cr-tabs-group">
          <button
            type="button"
            className={`cr-tab-btn ${activeTab === "approved" ? "active" : ""}`}
            onClick={() => setActiveTab("approved")}
          >
            <Users size={15} />
            Approved Creators
            <span className="cr-tab-count">{activeCreatorsCount}</span>
          </button>

          <button
            type="button"
            className={`cr-tab-btn ${
              activeTab === "applications" ? "active" : ""
            }`}
            onClick={() => setActiveTab("applications")}
          >
            <FileCheck2 size={15} />
            Creator Applications
            {activeTab === "applications" && (
              <span className="cr-tab-count">{applications.length}</span>
            )}
          </button>
        </div>
      </div>

      {/* ====================================================================
          TAB 1: APPROVED CREATORS (ACTIVE & BANNED)
          ==================================================================== */}
      {activeTab === "approved" && (
        <>
          <div className="cr-toolbar">
            <div className="cr-toolbar-left">
              <div className="cr-segmented">
                <button
                  type="button"
                  className={`cr-seg-btn ${
                    creatorFilter === "active" ? "active" : ""
                  }`}
                  onClick={() => {
                    setCreatorFilter("active");
                    setCreatorPage(1);
                  }}
                >
                  <ShieldCheck size={14} />
                  Active Creators ({activeCreatorsCount})
                </button>
                <button
                  type="button"
                  className={`cr-seg-btn ${
                    creatorFilter === "banned" ? "active" : ""
                  }`}
                  onClick={() => {
                    setCreatorFilter("banned");
                    setCreatorPage(1);
                  }}
                >
                  <ShieldAlert size={14} />
                  Banned Creators ({bannedCreatorsCount})
                </button>
              </div>

              <div className="cr-search-box">
                <Search size={15} className="cr-search-icon" />
                <input
                  type="text"
                  className="cr-search-input"
                  placeholder="Search creators by name..."
                  value={creatorSearch}
                  onChange={(e) => {
                    setCreatorSearch(e.target.value);
                    setCreatorPage(1);
                  }}
                />
                {creatorSearch && (
                  <button
                    type="button"
                    className="cr-search-clear"
                    onClick={() => {
                      setCreatorSearch("");
                      setCreatorPage(1);
                    }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="cr-segmented">
              <button
                type="button"
                className={`cr-seg-btn ${
                  creatorViewMode === "grid" ? "active" : ""
                }`}
                onClick={() => setCreatorViewMode("grid")}
              >
                <LayoutGrid size={14} />
                Cards
              </button>
              <button
                type="button"
                className={`cr-seg-btn ${
                  creatorViewMode === "table" ? "active" : ""
                }`}
                onClick={() => setCreatorViewMode("table")}
              >
                <ListIcon size={14} />
                Table
              </button>
            </div>
          </div>

          {creatorsLoading ? (
            creatorViewMode === "grid" ? (
              <div className="cr-grid">
                {Array.from({ length: 8 }).map((_, idx) => (
                  <div key={idx} className="cr-card">
                    <div
                      className="cr-card-media cr-shimmer"
                      style={{ borderRadius: 0 }}
                    />
                    <div className="cr-card-body">
                      <div
                        className="cr-shimmer"
                        style={{ width: "68%", height: 15 }}
                      />
                      <div
                        className="cr-shimmer"
                        style={{ width: "88%", height: 12, marginTop: 4 }}
                      />
                    </div>
                    <div className="cr-card-footer">
                      <div
                        className="cr-shimmer"
                        style={{ flex: 1, height: 30 }}
                      />
                      <div
                        className="cr-shimmer"
                        style={{ width: 58, height: 30 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cr-table-card">
                <div className="cr-table-wrap">
                  <table className="cr-table">
                    <thead>
                      <tr>
                        <th>Creator</th>
                        <th>Bio</th>
                        <th>Recipes</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <tr key={idx}>
                          <td>
                            <div className="cr-creator-identity">
                              <div
                                className="cr-shimmer"
                                style={{
                                  width: 44,
                                  height: 44,
                                  borderRadius: "50%",
                                }}
                              />
                              <div
                                className="cr-shimmer"
                                style={{ width: 125, height: 15 }}
                              />
                            </div>
                          </td>
                          <td>
                            <div
                              className="cr-shimmer"
                              style={{ width: 200, height: 14 }}
                            />
                          </td>
                          <td>
                            <div
                              className="cr-shimmer"
                              style={{ width: 70, height: 15 }}
                            />
                          </td>
                          <td>
                            <div
                              className="cr-shimmer"
                              style={{
                                width: 64,
                                height: 22,
                                borderRadius: 999,
                              }}
                            />
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 8,
                              }}
                            >
                              <div
                                className="cr-shimmer"
                                style={{ width: 70, height: 30 }}
                              />
                              <div
                                className="cr-shimmer"
                                style={{ width: 56, height: 30 }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : creators.length === 0 ? (
            <div className="cr-empty">
              <Users size={28} style={{ color: "#94a3b8" }} />
              <h4>
                No {creatorFilter === "banned" ? "banned" : "active"} creators
                found
              </h4>
              <p>
                {creatorSearch
                  ? `No creator matched "${creatorSearch}". Try clearing your search.`
                  : creatorFilter === "banned"
                  ? "There are currently no banned creators."
                  : "Approved creators will appear here once their applications are accepted."}
              </p>
            </div>
          ) : creatorViewMode === "grid" ? (
            <div className="cr-grid">
              {creators.map((creator) => {
                const isBanned =
                  creatorFilter === "banned"
                    ? true
                    : Boolean(creator.is_banned);
                const key = creator.id || creator.creator_name;
                const hasPhoto =
                  Boolean(creator.profile_picture_url) && !brokenAvatars[key];

                return (
                  <div key={creator.id} className="cr-card">
                    {/* Prominent Creator Image Area */}
                    <div
                      className="cr-card-media"
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        navigate(`/creators/${creator.id}`, {
                          state: { is_banned: isBanned, creator },
                        })
                      }
                    >
                      {hasPhoto ? (
                        <img
                          src={creator.profile_picture_url}
                          alt={creator.creator_name || "Creator"}
                          className="cr-card-photo"
                          onError={() =>
                            setBrokenAvatars((prev) => ({
                              ...prev,
                              [key]: true,
                            }))
                          }
                        />
                      ) : (
                        <div className="cr-card-initials">
                          {getInitials(creator.creator_name)}
                        </div>
                      )}

                      <span className="cr-card-recipe-pill">
                        <BookOpen size={12} />
                        {creator.total_recipes || 0}{" "}
                        {creator.total_recipes === 1 ? "recipe" : "recipes"}
                      </span>

                      <span
                        className={`cr-card-status-pill ${
                          isBanned ? "banned" : ""
                        }`}
                      >
                        {isBanned ? "Banned" : "Active"}
                      </span>
                    </div>

                    {/* Clean Uncluttered Card Body */}
                    <div className="cr-card-body">
                      <h3 className="cr-creator-name">
                        {creator.creator_name || "Unnamed Creator"}
                      </h3>
                      <p className="cr-bio">
                        {creator.description && creator.description.trim()
                          ? creator.description.trim()
                          : isBanned
                          ? "Suspended Creator Account"
                          : "Verified Cookeaze Creator"}
                      </p>
                    </div>

                    {/* Clean Action Footer */}
                    <div className="cr-card-footer">
                      <button
                        type="button"
                        className="cr-btn cr-btn-secondary cr-btn-sm"
                        style={{ flex: 1, minWidth: 0 }}
                        onClick={() =>
                          navigate(`/creators/${creator.id}`, {
                            state: { is_banned: isBanned, creator },
                          })
                        }
                      >
                        <Eye size={13} style={{ flexShrink: 0 }} />
                        <span>Profile</span>
                      </button>

                      <button
                        type="button"
                        className={`cr-btn cr-btn-sm ${
                          isBanned ? "cr-btn-primary" : "cr-btn-danger-ghost"
                        }`}
                        style={{ flexShrink: 0 }}
                        onClick={() => openBanModal(creator)}
                      >
                        {isBanned ? (
                          <>
                            <ShieldCheck size={13} style={{ flexShrink: 0 }} />
                            <span>Unban</span>
                          </>
                        ) : (
                          "Ban"
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="cr-table-card">
              <div className="cr-table-wrap">
                <table className="cr-table">
                  <thead>
                    <tr>
                      <th>Creator</th>
                      <th>Bio</th>
                      <th>Recipes</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {creators.map((creator) => {
                      const isBanned =
                        creatorFilter === "banned"
                          ? true
                          : Boolean(creator.is_banned);
                      return (
                        <tr key={creator.id}>
                          <td>
                            <div className="cr-creator-identity">
                              {renderTableAvatar(creator)}
                              <div>
                                <div
                                  style={{ fontWeight: 700, color: "#0f172a" }}
                                >
                                  {creator.creator_name || "Unnamed Creator"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ maxWidth: 320, color: "#64748b" }}>
                            {creator.description ||
                              (isBanned
                                ? "Suspended Creator Account"
                                : "Verified Creator")}
                          </td>
                          <td>
                            <strong>{creator.total_recipes || 0}</strong>{" "}
                            recipes
                          </td>
                          <td>
                            <span
                              className={`cr-badge ${
                                isBanned ? "banned" : "active"
                              }`}
                            >
                              {isBanned ? "Banned" : "Active"}
                            </span>
                          </td>
                          <td>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: 8,
                              }}
                            >
                              <button
                                type="button"
                                className="cr-btn cr-btn-secondary cr-btn-sm"
                                onClick={() =>
                                  navigate(`/creators/${creator.id}`, {
                                    state: { is_banned: isBanned, creator },
                                  })
                                }
                              >
                                <Eye size={13} />
                                Profile
                              </button>
                              <button
                                type="button"
                                className={`cr-btn cr-btn-sm ${
                                  isBanned
                                    ? "cr-btn-primary"
                                    : "cr-btn-danger-ghost"
                                }`}
                                onClick={() => openBanModal(creator)}
                              >
                                {isBanned ? "Unban" : "Ban"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {creatorTotalPages > 1 && (
            <div className="cr-pagination">
              <span className="cr-page-info">
                Page <strong>{creatorPage}</strong> of{" "}
                <strong>{creatorTotalPages}</strong>
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="cr-btn cr-btn-secondary cr-btn-sm"
                  disabled={creatorPage <= 1}
                  onClick={() => setCreatorPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  Previous
                </button>
                <button
                  type="button"
                  className="cr-btn cr-btn-secondary cr-btn-sm"
                  disabled={creatorPage >= creatorTotalPages}
                  onClick={() =>
                    setCreatorPage((p) => Math.min(creatorTotalPages, p + 1))
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

      {/* ====================================================================
          TAB 2: CREATOR APPLICATIONS
          ==================================================================== */}
      {activeTab === "applications" && (
        <>
          <div className="cr-toolbar">
            <div className="cr-toolbar-left">
              <div className="cr-segmented">
                {["pending", "approved", "rejected"].map((statusKey) => (
                  <button
                    key={statusKey}
                    type="button"
                    className={`cr-seg-btn ${
                      appStatusFilter === statusKey ? "active" : ""
                    }`}
                    onClick={() => setAppStatusFilter(statusKey)}
                  >
                    {statusKey.charAt(0).toUpperCase() + statusKey.slice(1)}
                  </button>
                ))}
              </div>

              <div className="cr-search-box">
                <Search size={15} className="cr-search-icon" />
                <input
                  type="text"
                  className="cr-search-input"
                  placeholder="Filter applicants by name or email..."
                  value={appSearch}
                  onChange={(e) => setAppSearch(e.target.value)}
                />
                {appSearch && (
                  <button
                    type="button"
                    className="cr-search-clear"
                    onClick={() => setAppSearch("")}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {appsLoading ? (
            <div className="cr-table-card">
              <div className="cr-table-wrap">
                <table className="cr-table">
                  <thead>
                    <tr>
                      <th>Chef / Brand Name</th>
                      <th>Applicant</th>
                      <th>Email Address</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <tr key={idx}>
                        <td>
                          <div
                            className="cr-shimmer"
                            style={{ width: 140, height: 15 }}
                          />
                        </td>
                        <td>
                          <div
                            className="cr-shimmer"
                            style={{ width: 120, height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="cr-shimmer"
                            style={{ width: 175, height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="cr-shimmer"
                            style={{ width: 72, height: 22, borderRadius: 999 }}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="cr-shimmer"
                            style={{
                              width: 130,
                              height: 32,
                              marginLeft: "auto",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : filteredApplications.length === 0 ? (
            <div className="cr-empty">
              <FileCheck2 size={28} style={{ color: "#94a3b8" }} />
              <h4>No {appStatusFilter} applications found</h4>
              <p>
                {appSearch
                  ? `No applicant matches "${appSearch}".`
                  : `There are currently no ${appStatusFilter} creator applications in the queue.`}
              </p>
            </div>
          ) : (
            <div className="cr-table-card">
              <div className="cr-table-wrap">
                <table className="cr-table">
                  <thead>
                    <tr>
                      <th>Chef / Brand Name</th>
                      <th>Applicant</th>
                      <th>Email Address</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredApplications.map((app) => (
                      <tr key={app.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#0f172a" }}>
                            {app.professional_name || "Unnamed Chef"}
                          </div>
                        </td>
                        <td>{app.user_full_name || "—"}</td>
                        <td style={{ color: "#64748b" }}>
                          {app.user_email || "—"}
                        </td>
                        <td>
                          <span className={`cr-badge ${app.status || "pending"}`}>
                            {String(app.status || "pending").toUpperCase()}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            className="cr-btn cr-btn-primary cr-btn-sm"
                            onClick={() => openApplicationReview(app.id)}
                          >
                            <Eye size={13} />
                            Review Application
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ====================================================================
          MODAL: BAN / UNBAN CREATOR
          ==================================================================== */}
      {banTarget && (
        <div
          className="cr-modal-backdrop"
          onClick={() => !banActionLoading && setBanTarget(null)}
        >
          <div
            className="cr-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cr-modal-header">
              <h3>
                {banTarget.is_banned
                  ? `Unban ${banTarget.creator_name}`
                  : `Ban ${banTarget.creator_name}`}
              </h3>
              <button
                type="button"
                className="cr-modal-close"
                onClick={() => setBanTarget(null)}
                disabled={banActionLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="cr-modal-body">
              {banTarget.is_banned ? (
                <p style={{ margin: 0, fontSize: "0.9rem", color: "#334155" }}>
                  Are you sure you want to restore{" "}
                  <strong>{banTarget.creator_name}</strong> to active creator
                  standing? Their profile and recipes will become visible again.
                </p>
              ) : (
                <>
                  <p style={{ margin: 0, fontSize: "0.86rem", color: "#475569" }}>
                    Select a quick moderation reason or write a custom explanation
                    for banning <strong>{banTarget.creator_name}</strong>:
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
                onClick={() => setBanTarget(null)}
                disabled={banActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`cr-btn ${
                  banTarget.is_banned ? "cr-btn-primary" : "cr-btn-danger"
                }`}
                onClick={handleConfirmBanToggle}
                disabled={banActionLoading}
              >
                {banActionLoading
                  ? "Processing..."
                  : banTarget.is_banned
                  ? "Confirm Unban"
                  : "Ban Creator"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: APPLICATION REVIEW & DECISION
          ==================================================================== */}
      {reviewModalOpen && (
        <div
          className="cr-modal-backdrop"
          onClick={() => !decisionLoading && setReviewModalOpen(false)}
        >
          <div
            className="cr-modal-card wide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cr-modal-header">
              <h3>Creator Application Review</h3>
              <button
                type="button"
                className="cr-modal-close"
                onClick={() => setReviewModalOpen(false)}
                disabled={decisionLoading}
              >
                <X size={16} />
              </button>
            </div>

            <div className="cr-modal-body">
              {appDetailLoading || !selectedApp ? (
                <>
                  <div className="cr-review-grid">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="cr-info-block">
                        <div
                          className="cr-shimmer"
                          style={{ width: 110, height: 11, marginBottom: 8 }}
                        />
                        <div
                          className="cr-shimmer"
                          style={{ width: "80%", height: 16 }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="cr-info-block">
                    <div
                      className="cr-shimmer"
                      style={{ width: 90, height: 11, marginBottom: 8 }}
                    />
                    <div
                      className="cr-shimmer"
                      style={{ width: "92%", height: 14, marginBottom: 6 }}
                    />
                    <div
                      className="cr-shimmer"
                      style={{ width: "70%", height: 14 }}
                    />
                  </div>
                  <div className="cr-info-block">
                    <div
                      className="cr-shimmer"
                      style={{ width: 160, height: 11, marginBottom: 10 }}
                    />
                    <div className="cr-doc-grid">
                      <div
                        className="cr-shimmer"
                        style={{ width: "100%", height: 150, borderRadius: 10 }}
                      />
                      <div
                        className="cr-shimmer"
                        style={{ width: "100%", height: 150, borderRadius: 10 }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="cr-review-grid">
                    <div className="cr-info-block">
                      <span className="cr-info-label">
                        Professional / Brand Name
                      </span>
                      <div className="cr-info-value">
                        {selectedApp.professional_name || "—"}
                      </div>
                    </div>

                    <div className="cr-info-block">
                      <span className="cr-info-label">Applicant Full Name</span>
                      <div className="cr-info-value">
                        {selectedApp.user_full_name || "—"} (
                        {selectedApp.user_email || "No email"})
                      </div>
                    </div>

                    <div className="cr-info-block">
                      <span className="cr-info-label">Primary Cuisines</span>
                      <div className="cr-info-value">
                        {Array.isArray(selectedApp.primary_cuisines) &&
                        selectedApp.primary_cuisines.length > 0
                          ? selectedApp.primary_cuisines.join(", ")
                          : "None listed"}
                      </div>
                    </div>

                    <div className="cr-info-block">
                      <span className="cr-info-label">
                        Government ID Verification
                      </span>
                      <div className="cr-info-value">
                        {selectedApp.gov_id_type_display || "Standard ID"}
                      </div>
                    </div>
                  </div>

                  <div className="cr-info-block">
                    <span className="cr-info-label">Culinary Bio</span>
                    <div
                      className="cr-info-value"
                      style={{ fontWeight: 400, color: "#334155" }}
                    >
                      {selectedApp.bio || "No bio provided."}
                    </div>
                  </div>

                  {/* Clean Social Links (String URL or Map safe) */}
                  {selectedSocialLinks.length > 0 && (
                    <div className="cr-info-block">
                      <span className="cr-info-label">
                        Social Media & Portfolio Link
                      </span>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 10,
                          marginTop: 6,
                        }}
                      >
                        {selectedSocialLinks.map((item, idx) => (
                          <a
                            key={idx}
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="cr-btn cr-btn-soft cr-btn-sm"
                          >
                            {item.label}
                            <ExternalLink size={13} />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Government ID & Portfolio Media (Single URL string or Array safe) */}
                  {(selectedGovIdUrls.length > 0 ||
                    selectedMediaUrls.length > 0) && (
                    <div className="cr-info-block">
                      <span className="cr-info-label">
                        Submitted Verification & Media Files
                      </span>
                      <div className="cr-doc-grid">
                        {selectedGovIdUrls.map((imgUrl, idx) => (
                          <a
                            key={`id-${idx}`}
                            href={imgUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="cr-doc-thumb"
                          >
                            <img src={imgUrl} alt={`Government ID ${idx + 1}`} />
                            <span>
                              View Government ID{" "}
                              {selectedGovIdUrls.length > 1 ? `#${idx + 1}` : ""}
                            </span>
                          </a>
                        ))}

                        {selectedMediaUrls.map((mediaUrl, idx) => (
                          <a
                            key={`media-${idx}`}
                            href={mediaUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="cr-doc-thumb"
                          >
                            <img
                              src={mediaUrl}
                              alt={`Portfolio Sample ${idx + 1}`}
                            />
                            <span>Portfolio Sample #{idx + 1}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Decision Section */}
                  {selectedApp.status === "pending" ? (
                    <div className="cr-info-block">
                      <span className="cr-info-label">
                        Rejection Reason (Required only if rejecting)
                      </span>
                      <div
                        className="cr-reason-pills"
                        style={{ marginBottom: 8 }}
                      >
                        {REJECT_REASON_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className="cr-reason-pill"
                            onClick={() => setRejectionReason(preset)}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="cr-textarea"
                        placeholder="Explain why the application is being rejected so the chef can re-apply..."
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="cr-info-block">
                      <span className="cr-info-label">Review History</span>
                      <div className="cr-info-value">
                        Status:{" "}
                        <span
                          className={`cr-badge ${selectedApp.status || "neutral"}`}
                        >
                          {String(selectedApp.status).toUpperCase()}
                        </span>
                      </div>
                      {selectedApp.reviewed_by_email && (
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#64748b",
                            marginTop: 4,
                          }}
                        >
                          Reviewed by {selectedApp.reviewed_by_email}{" "}
                          {selectedApp.reviewed_at
                            ? `on ${new Date(
                                selectedApp.reviewed_at
                              ).toLocaleString()}`
                            : ""}
                        </div>
                      )}
                      {selectedApp.rejection_reason && (
                        <div
                          style={{
                            fontSize: "0.82rem",
                            color: "#b91c1c",
                            marginTop: 6,
                          }}
                        >
                          Reason: {selectedApp.rejection_reason}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="cr-modal-footer">
              <button
                type="button"
                className="cr-btn cr-btn-secondary"
                onClick={() => setReviewModalOpen(false)}
                disabled={decisionLoading}
              >
                Close
              </button>

              {selectedApp?.status === "pending" && (
                <>
                  <button
                    type="button"
                    className="cr-btn cr-btn-danger"
                    disabled={decisionLoading}
                    onClick={() => handleApplicationDecision("reject")}
                  >
                    {decisionLoading ? "Saving..." : "Reject Application"}
                  </button>
                  <button
                    type="button"
                    className="cr-btn cr-btn-primary"
                    disabled={decisionLoading}
                    onClick={() => handleApplicationDecision("approve")}
                  >
                    <CheckCircle2 size={15} />
                    {decisionLoading ? "Approving..." : "Approve Creator"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
