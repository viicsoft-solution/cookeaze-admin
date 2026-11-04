// src/pages/UsersPage.js
import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Users,
  UserPlus,
  RefreshCw,
  Search,
  ShieldCheck,
  Star,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Trash2,
  X,
  Phone,
  Globe,
  LayoutGrid,
  List,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./UsersPage.css";

const USERS_CACHE_KEY = "cookeaze_users_directory_cache_v5";

const ROLE_FILTER_OPTIONS = [
  { key: "all", label: "All Roles" },
  { key: "superAdmin", label: "Super Admin" },
  { key: "admin", label: "Admin" },
  { key: "creator", label: "Creator" },
  { key: "rider", label: "Rider" },
  { key: "user", label: "User" },
];

const DATE_FILTER_OPTIONS = [
  { key: "all", label: "Date: All Time", shortLabel: "All Time" },
  { key: "today", label: "Date: Today", shortLabel: "Today" },
  { key: "week", label: "Date: This Week", shortLabel: "This Week" },
  { key: "month", label: "Date: This Month", shortLabel: "This Month" },
];

/**
 * Safely extract an array of users from any backend response envelope
 */
function extractUsersArray(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.results)) return payload.results;
  if (Array.isArray(payload.users)) return payload.users;
  if (Array.isArray(payload.creators)) return payload.creators;
  if (Array.isArray(payload.riders)) return payload.riders;
  if (payload.data && typeof payload.data === "object") {
    if (Array.isArray(payload.data.results)) return payload.data.results;
    if (Array.isArray(payload.data.users)) return payload.data.users;
    if (Array.isArray(payload.data.creators)) return payload.data.creators;
    if (Array.isArray(payload.data.riders)) return payload.data.riders;
    if (Array.isArray(payload.data.items)) return payload.data.items;
    if (Array.isArray(payload.data.data)) return payload.data.data;
  }
  return [];
}

/**
 * Extract pagination metadata (`count`, `total_pages`, `next`) from any backend response shape.
 */
function extractPaginationMeta(payload) {
  if (!payload || typeof payload !== "object") {
    return { count: null, totalPages: null, next: null };
  }
  const inner =
    payload.data && typeof payload.data === "object" && !Array.isArray(payload.data)
      ? payload.data
      : null;
  const pag =
    payload.pagination && typeof payload.pagination === "object"
      ? payload.pagination
      : inner?.pagination && typeof inner.pagination === "object"
      ? inner.pagination
      : null;

  const rawCount =
    pag?.count ??
    inner?.count ??
    payload.count ??
    pag?.total ??
    inner?.total ??
    payload.total ??
    null;

  const rawTotalPages =
    pag?.total_pages ??
    inner?.total_pages ??
    payload.total_pages ??
    pag?.pages ??
    inner?.pages ??
    null;

  const rawNext = pag?.next ?? inner?.next ?? payload.next ?? null;

  return {
    count: typeof rawCount === "number" ? rawCount : null,
    totalPages: typeof rawTotalPages === "number" ? rawTotalPages : null,
    next: typeof rawNext === "string" && rawNext.trim() ? rawNext.trim() : null,
  };
}

function extractUserObject(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (
    payload.data &&
    typeof payload.data === "object" &&
    !Array.isArray(payload.data)
  ) {
    return payload.data;
  }
  return payload;
}

function formatUserApiError(err, fallback = "Operation failed. Please try again.") {
  const data = err?.response?.data;
  if (!data) return err?.message || fallback;
  if (typeof data === "string") return data;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  const source = data.errors && typeof data.errors === "object" ? data.errors : data;
  const parts = [];
  Object.entries(source).forEach(([k, v]) => {
    if (["isSuccessful", "success", "status"].includes(k)) return;
    if (Array.isArray(v)) parts.push(`${k}: ${v.join(", ")}`);
    else if (typeof v === "string") parts.push(`${k}: ${v}`);
  });
  return parts.length > 0 ? parts.join(" | ") : fallback;
}

/**
 * Title-case a single word cleanly
 */
function toTitleCaseWord(word) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Clean, human-friendly display name that:
 * 1. Never shows an `@email.com` address as the person's name
 * 2. Deduplicates repeated names (e.g. "Ginikanwa Maryrose Okosa Ginikanwa Maryrose Okosa" -> "Ginikanwa Maryrose Okosa")
 * 3. Formats ALL-CAPS or all-lowercase names into clean Title Case
 */
function getUserDisplayName(u) {
  if (!u) return "Unnamed Member";

  const cleanPart = (val) => {
    if (!val || typeof val !== "string") return "";
    const trimmed = val.trim();
    if (trimmed.includes("@")) return "";
    return trimmed;
  };

  let first = cleanPart(u.first_name);
  let last = cleanPart(u.last_name);

  if (first && last) {
    const fLow = first.toLowerCase();
    const lLow = last.toLowerCase();
    if (fLow === lLow || fLow.includes(lLow)) {
      last = "";
    } else if (lLow.includes(fLow)) {
      first = last;
      last = "";
    }
  }

  let rawName = `${first} ${last}`.trim();

  if (!rawName) {
    const candidate =
      cleanPart(u.full_name) ||
      cleanPart(u.creator_name) ||
      cleanPart(u.name) ||
      cleanPart(u.username);
    if (candidate) rawName = candidate;
  }

  if (rawName) {
    const words = rawName.split(/\s+/).filter(Boolean);
    if (words.length >= 2 && words.length % 2 === 0) {
      const half = words.length / 2;
      const firstHalf = words.slice(0, half).join(" ").toLowerCase();
      const secondHalf = words.slice(half).join(" ").toLowerCase();
      if (firstHalf === secondHalf) {
        rawName = words.slice(0, half).join(" ");
      }
    }
    const dedupedWords = [];
    words.forEach((w) => {
      if (
        dedupedWords.length === 0 ||
        dedupedWords[dedupedWords.length - 1].toLowerCase() !== w.toLowerCase()
      ) {
        dedupedWords.push(w);
      }
    });
    const finalWords = rawName.split(/\s+/).filter(Boolean);
    const chosenWords =
      finalWords.length < dedupedWords.length ? finalWords : dedupedWords;
    return chosenWords.map(toTitleCaseWord).join(" ");
  }

  if (u.email && typeof u.email === "string") {
    const localPart = u.email.split("@")[0] || "";
    const cleaned = localPart
      .replace(/[._-]+/g, " ")
      .replace(/\d+/g, " ")
      .trim();
    if (cleaned) {
      return cleaned
        .split(/\s+/)
        .filter(Boolean)
        .map(toTitleCaseWord)
        .join(" ");
    }
  }

  return "Unnamed Member";
}

function getUserInitials(u) {
  const name = getUserDisplayName(u);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "U";
}

function getAvatarToneIndex(u) {
  const seed = Number(u?.id) || String(u?.email || "").length || 0;
  return Math.abs(seed) % 6;
}

function getRoleLabel(role) {
  switch (role) {
    case "superAdmin":
      return "Super Admin";
    case "admin":
      return "Admin";
    case "creator":
      return "Creator";
    case "rider":
      return "Rider";
    default:
      return "User";
  }
}

function getUserJoinDateString(u) {
  if (!u || typeof u !== "object") return null;
  return (
    u.date_joined ||
    u.created_at ||
    u.createdAt ||
    u.registered_at ||
    u.joined_at ||
    null
  );
}

/**
 * Check if a user's join timestamp falls within `today`, `week`, or `month`.
 * When `hasClientTimestamps` is true and the server did not already filter the payload,
 * records without a join timestamp do not match narrow date windows (`today`, `week`, `month`).
 */
function matchesDateWindow(
  u,
  dateFilter,
  hasClientTimestamps = false,
  isServerDateFiltered = false
) {
  if (!dateFilter || dateFilter === "all") return true;
  const rawDate = getUserJoinDateString(u);
  if (!rawDate) {
    return isServerDateFiltered || !hasClientTimestamps;
  }
  const joined = new Date(rawDate);
  if (Number.isNaN(joined.getTime())) {
    return isServerDateFiltered || !hasClientTimestamps;
  }

  const now = new Date();
  if (dateFilter === "today") {
    return (
      joined.getFullYear() === now.getFullYear() &&
      joined.getMonth() === now.getMonth() &&
      joined.getDate() === now.getDate()
    );
  }
  if (dateFilter === "week") {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return joined >= weekAgo;
  }
  if (dateFilter === "month") {
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return joined >= monthAgo;
  }
  return true;
}

export default function UsersPage() {
  const api = useMemo(() => getAxiosInstance(), []);

  const [users, setUsers] = useState([]);
  const [serverTotalCount, setServerTotalCount] = useState(null);
  const [filteredServerCount, setFilteredServerCount] = useState(null);
  const [platformStats, setPlatformStats] = useState(null);
  const [verifiedCreatorsCount, setVerifiedCreatorsCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncingPages, setSyncingPages] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ loadedPages: 0, totalPages: 0 });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const abortRef = useRef(null);

  // Filters, sorting, view & pagination
  const [roleFilter, setRoleFilter] = useState("all"); // all | superAdmin | admin | creator | rider | user | adminGroup
  const [dateFilter, setDateFilter] = useState("all"); // all | today | week | month
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("table"); // table | cards
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 15;

  // Create New User Modal (`POST /users/`)
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    phone_number: "",
    country: "",
    skillLevel: "Beginner",
    description: "",
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Inspect / Manage User Modal (`GET`, `PATCH /users/{id}/`, `PUT /users/{id}/change-role/`)
  const [editUserTarget, setEditUserTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone_number: "",
    country: "",
    skillLevel: "",
    language: "en",
    description: "",
  });
  const [modalRole, setModalRole] = useState("user");
  const [modalRoleSaving, setModalRoleSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Change Password Modal (`POST /users/{id}/change-password/`)
  const [pwdTarget, setPwdTarget] = useState(null);
  const [pwdForm, setPwdForm] = useState({
    old_password: "",
    new_password: "",
    confirm_new_password: "",
  });
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState("");

  // Lookup User Modal (`POST /users/lookup/`)
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupIdentifier, setLookupIdentifier] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState("");

  // Delete User Modal (`DELETE /users/{id}/`)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Broken avatar URL tracker
  const [brokenAvatars, setBrokenAvatars] = useState({});

  /**
   * Merge an array of user objects into a Map keyed by numeric ID,
   * preserving enriched roles (e.g. creator, admin, superAdmin, rider).
   */
  const mergeUsersIntoMap = useCallback(
    (targetMap, incomingList, creatorIdSet, creatorEmailSet, riderIdSet) => {
      let addedNew = 0;
      incomingList.forEach((raw) => {
        if (!raw || typeof raw !== "object") return;
        const uid = Number(raw.id ?? raw.user_id);
        if (!uid || Number.isNaN(uid)) return;

        const existing = targetMap.get(uid) || {};
        const emailLower = String(raw.email || existing.email || "")
          .trim()
          .toLowerCase();

        let resolvedRole = raw.role || existing.role || "user";
        if (
          resolvedRole === "user" &&
          (creatorIdSet.has(uid) || (emailLower && creatorEmailSet.has(emailLower)))
        ) {
          resolvedRole = "creator";
        } else if (resolvedRole === "user" && riderIdSet.has(uid)) {
          resolvedRole = "rider";
        }

        if (!targetMap.has(uid)) {
          addedNew += 1;
        }

        targetMap.set(uid, {
          ...existing,
          ...raw,
          id: uid,
          role: resolvedRole,
        });
      });
      return addedNew;
    },
    []
  );

  // Build query params for `/users/` supporting `today`, `week`, `month`, `all`
  const buildDateQueryParams = useCallback((activeDateFilter, extra = {}) => {
    const params = { ...extra };
    if (activeDateFilter && activeDateFilter !== "all") {
      params.filter = activeDateFilter;
      params.period = activeDateFilter;
      params.date_filter = activeDateFilter;
      params.timeframe = activeDateFilter;
    }
    return params;
  }, []);

  // Fetch users for the active date filter (`all`, `today`, `week`, `month`)
  const fetchUsers = useCallback(
    async (forceRefresh = false, targetDateFilter = dateFilter) => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setError("");

      // Use session cache only for "all" when not forcing refresh
      if (!forceRefresh && targetDateFilter === "all") {
        try {
          const cachedRaw = sessionStorage.getItem(USERS_CACHE_KEY);
          if (cachedRaw) {
            const parsed = JSON.parse(cachedRaw);
            if (
              parsed &&
              Array.isArray(parsed.users) &&
              parsed.users.length > 0 &&
              Date.now() - (parsed.timestamp || 0) < 120000
            ) {
              setUsers(parsed.users);
              if (parsed.serverTotalCount) {
                setServerTotalCount(parsed.serverTotalCount);
              }
              if (parsed.verifiedCreatorsCount !== undefined) {
                setVerifiedCreatorsCount(parsed.verifiedCreatorsCount);
              }
              setLoading(false);
            }
          }
        } catch {
          // ignore cache error
        }
      } else {
        setLoading(true);
      }

      try {
        const [
          firstPageRes,
          statsRes,
          creatorsPublicRes,
          usersCreatorsRes,
          meRes,
          ridersRes,
        ] = await Promise.allSettled([
          api.get("/users/", {
            params: buildDateQueryParams(targetDateFilter, {
              page: 1,
              page_size: 100,
            }),
            signal: controller.signal,
          }),
          api.get("/analytics/statistics/", { signal: controller.signal }),
          api.get("/creators/", {
            params: { page: 1, page_size: 100 },
            signal: controller.signal,
          }),
          api.get("/users/creators/", { signal: controller.signal }),
          api.get("/users/me/", { signal: controller.signal }),
          api.get("/riders/", {
            params: { page: 1, page_size: 100 },
            signal: controller.signal,
          }),
        ]);

        if (controller.signal.aborted) return;

        if (firstPageRes.status === "rejected") {
          throw firstPageRes.reason;
        }

        const creatorIdSet = new Set();
        const creatorEmailSet = new Set();
        const riderIdSet = new Set();

        let creatorsList = [];
        if (creatorsPublicRes.status === "fulfilled") {
          const pubCreators = extractUsersArray(creatorsPublicRes.value.data);
          const pubCount =
            creatorsPublicRes.value.data?.pagination?.count ?? pubCreators.length;
          setVerifiedCreatorsCount(pubCount);
          creatorsList = creatorsList.concat(pubCreators);
        }
        if (usersCreatorsRes.status === "fulfilled") {
          const adminCreators = extractUsersArray(usersCreatorsRes.value.data);
          creatorsList = creatorsList.concat(adminCreators);
        }

        creatorsList.forEach((c) => {
          if (!c || typeof c !== "object") return;
          const cid = Number(c.user_id ?? c.id);
          if (cid && !Number.isNaN(cid)) creatorIdSet.add(cid);
          const cEmail = String(c.email || c.user_email || "")
            .trim()
            .toLowerCase();
          if (cEmail) creatorEmailSet.add(cEmail);
        });

        let ridersList = [];
        if (ridersRes.status === "fulfilled") {
          ridersList = extractUsersArray(ridersRes.value.data);
          ridersList.forEach((r) => {
            const rid = Number(r.user_id ?? r.id);
            if (rid && !Number.isNaN(rid)) riderIdSet.add(rid);
          });
        }

        let statsTotalRegistered = null;
        if (statsRes.status === "fulfilled") {
          const stData = statsRes.value.data?.data || statsRes.value.data;
          if (stData?.users) {
            setPlatformStats(stData.users);
            if (typeof stData.users.total_registered === "number") {
              statsTotalRegistered = stData.users.total_registered;
            }
          }
        }

        const page1Payload = firstPageRes.value.data;
        const page1Users = extractUsersArray(page1Payload);
        const pagMeta = extractPaginationMeta(page1Payload);

        const mergedMap = new Map();
        mergeUsersIntoMap(
          mergedMap,
          page1Users,
          creatorIdSet,
          creatorEmailSet,
          riderIdSet
        );

        // Merge `/users/me/`, creators, and riders so role tabs (Super Admin, Admin, Creator, Rider) always have their records
        if (targetDateFilter === "all") {
          if (meRes.status === "fulfilled") {
            const meObj = extractUserObject(meRes.value.data);
            if (meObj && meObj.id) {
              mergeUsersIntoMap(
                mergedMap,
                [meObj],
                creatorIdSet,
                creatorEmailSet,
                riderIdSet
              );
            }
          }

          creatorsList.forEach((c) => {
            const cid = Number(c.user_id ?? c.id);
            if (
              cid &&
              !mergedMap.has(cid) &&
              (c.email || c.first_name || c.creator_name || c.full_name)
            ) {
              mergedMap.set(cid, {
                id: cid,
                first_name: c.first_name || c.creator_name || c.full_name || "",
                last_name: c.last_name || "",
                email: c.email || c.user_email || "",
                phone_number: c.phone_number || "",
                country: c.country || "",
                profile_picture_url:
                  c.profile_picture_url || c.profile_image || null,
                role: "creator",
                is_active: c.is_banned ? false : true,
              });
            }
          });

          ridersList.forEach((r) => {
            const rid = Number(r.user_id ?? r.id);
            if (
              rid &&
              !mergedMap.has(rid) &&
              (r.email || r.first_name || r.full_name || r.name)
            ) {
              mergedMap.set(rid, {
                id: rid,
                first_name: r.first_name || r.full_name || r.name || "",
                last_name: r.last_name || "",
                email: r.email || "",
                phone_number: r.phone_number || r.phone || "",
                country: r.country || r.city || "",
                profile_picture_url:
                  r.profile_picture_url || r.profile_image || null,
                role: "rider",
                is_active: true,
              });
            }
          });
        }

        const highestId = page1Users.reduce(
          (max, u) => Math.max(max, Number(u?.id) || 0),
          0
        );

        const resolvedGlobalTotal =
          statsTotalRegistered ??
          pagMeta.count ??
          (page1Users.length >= 100 && highestId > 100
            ? highestId
            : mergedMap.size);

        setServerTotalCount((prev) =>
          targetDateFilter === "all"
            ? resolvedGlobalTotal
            : prev ?? resolvedGlobalTotal
        );

        const resolvedFilteredCount =
          pagMeta.count ??
          (targetDateFilter === "all" ? resolvedGlobalTotal : mergedMap.size);

        if (targetDateFilter === "all") {
          setFilteredServerCount(null);
        } else {
          setFilteredServerCount(
            pagMeta.count !== null ? pagMeta.count : page1Users.length
          );
        }

        const initialArray = Array.from(mergedMap.values());
        setUsers(initialArray);
        setLoading(false);

        // Fetch remaining pages if paginated
        const perPage = page1Users.length || 100;
        const estimatedTotalPages =
          pagMeta.totalPages ||
          (resolvedFilteredCount > perPage && page1Users.length >= 100
            ? Math.ceil(resolvedFilteredCount / perPage)
            : pagMeta.next
            ? 10
            : 1);

        if (estimatedTotalPages > 1 && page1Users.length >= 100) {
          setSyncingPages(true);
          setSyncProgress({ loadedPages: 1, totalPages: estimatedTotalPages });

          let usesOffsetPagination = false;
          try {
            const p2Res = await api.get("/users/", {
              params: buildDateQueryParams(targetDateFilter, {
                page: 2,
                page_size: perPage,
              }),
              signal: controller.signal,
            });
            const p2List = extractUsersArray(p2Res.data);
            const addedFromP2 = mergeUsersIntoMap(
              mergedMap,
              p2List,
              creatorIdSet,
              creatorEmailSet,
              riderIdSet
            );

            if (p2List.length > 0 && addedFromP2 === 0) {
              const offsetRes = await api.get("/users/", {
                params: buildDateQueryParams(targetDateFilter, {
                  limit: perPage,
                  offset: perPage,
                }),
                signal: controller.signal,
              });
              const offsetList = extractUsersArray(offsetRes.data);
              const addedFromOffset = mergeUsersIntoMap(
                mergedMap,
                offsetList,
                creatorIdSet,
                creatorEmailSet,
                riderIdSet
              );
              if (addedFromOffset > 0) {
                usesOffsetPagination = true;
              }
            }
          } catch {
            // page 2 not supported
          }

          if (!controller.signal.aborted && mergedMap.size > page1Users.length) {
            const updatedList = Array.from(mergedMap.values());
            setUsers(updatedList);
            setSyncProgress({ loadedPages: 2, totalPages: estimatedTotalPages });

            const remainingPages = [];
            for (let p = 3; p <= Math.min(estimatedTotalPages, 25); p += 1) {
              remainingPages.push(p);
            }

            const BATCH_SIZE = 4;
            for (let i = 0; i < remainingPages.length; i += BATCH_SIZE) {
              if (controller.signal.aborted) break;
              const batch = remainingPages.slice(i, i + BATCH_SIZE);
              const batchResults = await Promise.allSettled(
                batch.map((p) =>
                  api.get("/users/", {
                    params: buildDateQueryParams(
                      targetDateFilter,
                      usesOffsetPagination
                        ? { limit: perPage, offset: (p - 1) * perPage }
                        : { page: p, page_size: perPage }
                    ),
                    signal: controller.signal,
                  })
                )
              );

              if (controller.signal.aborted) break;

              let batchAdded = 0;
              batchResults.forEach((res) => {
                if (res.status === "fulfilled") {
                  const list = extractUsersArray(res.value.data);
                  batchAdded += mergeUsersIntoMap(
                    mergedMap,
                    list,
                    creatorIdSet,
                    creatorEmailSet,
                    riderIdSet
                  );
                }
              });

              const nextList = Array.from(mergedMap.values());
              setUsers(nextList);
              setSyncProgress({
                loadedPages: Math.min(
                  estimatedTotalPages,
                  2 + i + batch.length
                ),
                totalPages: estimatedTotalPages,
              });

              if (batchAdded === 0) {
                break;
              }
            }
          }

          setSyncingPages(false);
        }

        const finalUsers = Array.from(mergedMap.values());
        if (targetDateFilter !== "all" && pagMeta.count === null) {
          setFilteredServerCount(finalUsers.length);
        }
        if (targetDateFilter === "all") {
          const finalTotal = Math.max(
            resolvedGlobalTotal || 0,
            finalUsers.length
          );
          setServerTotalCount(finalTotal);
          try {
            sessionStorage.setItem(
              USERS_CACHE_KEY,
              JSON.stringify({
                users: finalUsers,
                serverTotalCount: finalTotal,
                verifiedCreatorsCount,
                timestamp: Date.now(),
              })
            );
          } catch {
            // ignore storage quota
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          formatUserApiError(
            err,
            "Failed to load users. Please check your admin permissions and try again."
          )
        );
        setLoading(false);
        setSyncingPages(false);
      }
    },
    [api, buildDateQueryParams, dateFilter, mergeUsersIntoMap, verifiedCreatorsCount]
  );

  // Re-fetch from API whenever `dateFilter` changes (`all` | `today` | `week` | `month`)
  useEffect(() => {
    fetchUsers(dateFilter !== "all", dateFilter);
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [dateFilter, fetchUsers]);

  // Reset to page 1 when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [roleFilter, dateFilter, search, sortBy]);

  // Determine whether client-side join timestamps exist or if server already filtered by date
  const hasClientTimestamps = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    return safeUsers.some((u) => Boolean(getUserJoinDateString(u)));
  }, [users]);

  const isServerDateFiltered = useMemo(() => {
    if (dateFilter === "all") return false;
    if (
      filteredServerCount !== null &&
      serverTotalCount !== null &&
      filteredServerCount < serverTotalCount
    ) {
      return true;
    }
    return false;
  }, [dateFilter, filteredServerCount, serverTotalCount]);

  // Users matching the active Date Filter (`all` | `today` | `week` | `month`)
  const dateScopedUsers = useMemo(() => {
    const safeUsers = Array.isArray(users) ? users : [];
    if (dateFilter === "all") return safeUsers;
    return safeUsers.filter((u) =>
      matchesDateWindow(u, dateFilter, hasClientTimestamps, isServerDateFiltered)
    );
  }, [users, dateFilter, hasClientTimestamps, isServerDateFiltered]);

  // Summary KPIs & Role counts (scoped to the active date filter when applicable)
  const stats = useMemo(() => {
    const list = Array.isArray(users) ? users : [];
    const loadedCount = list.length;
    const total =
      serverTotalCount && serverTotalCount > loadedCount
        ? serverTotalCount
        : loadedCount;

    const dateCount =
      dateFilter === "all"
        ? total
        : isServerDateFiltered &&
          filteredServerCount !== null &&
          !hasClientTimestamps
        ? filteredServerCount
        : dateScopedUsers.length;

    const roleCounts = {
      all: dateFilter === "all" ? total : dateCount,
      superAdmin: dateScopedUsers.filter((u) => u.role === "superAdmin").length,
      admin: dateScopedUsers.filter((u) => u.role === "admin").length,
      creator:
        dateFilter === "all" && verifiedCreatorsCount !== null
          ? Math.max(
              verifiedCreatorsCount,
              dateScopedUsers.filter((u) => u.role === "creator").length
            )
          : dateScopedUsers.filter((u) => u.role === "creator").length,
      rider: dateScopedUsers.filter((u) => u.role === "rider").length,
      user: dateScopedUsers.filter((u) => (u.role || "user") === "user").length,
    };

    const admins = dateScopedUsers.filter(
      (u) => u.role === "superAdmin" || u.role === "admin"
    ).length;

    const creators = roleCounts.creator;

    const inactiveInScope = dateScopedUsers.filter(
      (u) => u.is_active === false
    ).length;
    const active = Math.max(0, dateCount - inactiveInScope);

    return {
      total,
      dateCount,
      loadedCount,
      admins,
      creators,
      active,
      roleCounts,
      dau: platformStats?.["daily_active_users (DAU)"] ?? null,
      mau: platformStats?.["monthly_active_users (MAU)"] ?? null,
    };
  }, [
    users,
    dateScopedUsers,
    dateFilter,
    isServerDateFiltered,
    filteredServerCount,
    hasClientTimestamps,
    serverTotalCount,
    verifiedCreatorsCount,
    platformStats,
  ]);

  // Filtered + Sorted Users
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();

    const list = dateScopedUsers.filter((u) => {
      if (!u) return false;

      // 1. Role Filter (`all`, `superAdmin`, `admin`, `creator`, `rider`, `user`, `adminGroup`)
      const uRole = u.role || "user";
      if (roleFilter === "adminGroup") {
        if (uRole !== "admin" && uRole !== "superAdmin") return false;
      } else if (roleFilter !== "all" && uRole !== roleFilter) {
        return false;
      }

      // 2. Search Query
      if (!q) return true;
      const fullName = getUserDisplayName(u).toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const phone = String(u.phone_number || "").toLowerCase();
      const country = String(u.country || "").toLowerCase();
      const refCode = String(u.referral_code || "").toLowerCase();
      const idStr = String(u.id || "");

      return (
        fullName.includes(q) ||
        email.includes(q) ||
        phone.includes(q) ||
        country.includes(q) ||
        refCode.includes(q) ||
        idStr.includes(q)
      );
    });

    list.sort((a, b) => {
      if (sortBy === "name-asc") {
        return getUserDisplayName(a).localeCompare(getUserDisplayName(b));
      }
      if (sortBy === "name-desc") {
        return getUserDisplayName(b).localeCompare(getUserDisplayName(a));
      }
      if (sortBy === "oldest") {
        return (Number(a.id) || 0) - (Number(b.id) || 0);
      }
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });

    return list;
  }, [dateScopedUsers, roleFilter, search, sortBy]);

  // Active filter human-readable labels & displayed count
  const activeDateOption =
    DATE_FILTER_OPTIONS.find((d) => d.key === dateFilter) ||
    DATE_FILTER_OPTIONS[0];
  const hasActiveFilter =
    dateFilter !== "all" || roleFilter !== "all" || Boolean(search.trim());
  const displayedMatchCount =
    !hasActiveFilter ? stats.total : filteredUsers.length;

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / usersPerPage));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * usersPerPage;
    return filteredUsers.slice(start, start + usersPerPage);
  }, [filteredUsers, currentPage]);

  // 1. Handle Role Change inside User Detail Modal (`PUT /users/{id}/change-role/`)
  const handleModalRoleUpdate = async () => {
    if (!editUserTarget) return;
    const id = editUserTarget.id;
    if (!modalRole) return;

    setModalRoleSaving(true);
    setEditError("");
    try {
      const res = await api.put(`/users/${id}/change-role/`, {
        role: modalRole,
      });
      setUsers((prev) =>
        prev.map((u) => (u.id === id ? { ...u, role: modalRole } : u))
      );
      setEditUserTarget((prev) =>
        prev ? { ...prev, role: modalRole } : prev
      );
      setNotice(
        res.data?.message ||
          `Updated role for ${getUserDisplayName(editUserTarget)} to ${getRoleLabel(
            modalRole
          )}.`
      );
    } catch (err) {
      setEditError(formatUserApiError(err, "Failed to update user role."));
    } finally {
      setModalRoleSaving(false);
    }
  };

  // 2. Create New User (`POST /users/`)
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateError("");
    if (
      !createForm.first_name.trim() ||
      !createForm.last_name.trim() ||
      !createForm.email.trim() ||
      !createForm.password
    ) {
      setCreateError("First name, last name, email, and password are required.");
      return;
    }
    if (createForm.password.length < 6) {
      setCreateError("Password must be at least 6 characters.");
      return;
    }

    setCreateSaving(true);
    try {
      const payload = {
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
      };
      if (createForm.phone_number.trim()) {
        payload.phone_number = createForm.phone_number.trim();
      }
      if (createForm.country.trim()) {
        payload.country = createForm.country.trim();
      }
      if (createForm.skillLevel) {
        payload.skillLevel = createForm.skillLevel;
      }
      if (createForm.description.trim()) {
        payload.description = createForm.description.trim();
      }

      const res = await api.post("/users/", payload);
      const created = extractUserObject(res.data);
      if (created && created.id) {
        setUsers((prev) => [created, ...prev]);
        setServerTotalCount((prev) => (prev ? prev + 1 : null));
      } else {
        await fetchUsers(true, dateFilter);
      }
      setNotice(`Account for "${payload.email}" created.`);
      setCreateOpen(false);
      setCreateForm({
        first_name: "",
        last_name: "",
        email: "",
        password: "",
        phone_number: "",
        country: "",
        skillLevel: "Beginner",
        description: "",
      });
    } catch (err) {
      setCreateError(formatUserApiError(err, "Failed to create user."));
    } finally {
      setCreateSaving(false);
    }
  };

  // 3. Open Inspect / Manage User Modal (`GET` & `PATCH /users/{id}/`)
  const openEditUserModal = async (u) => {
    setEditError("");
    setEditUserTarget(u);
    setModalRole(u.role || "user");
    setEditForm({
      first_name:
        u.first_name && !String(u.first_name).includes("@") ? u.first_name : "",
      last_name:
        u.last_name && !String(u.last_name).includes("@") ? u.last_name : "",
      email: u.email || "",
      phone_number: u.phone_number || "",
      country: u.country || "",
      skillLevel: u.skillLevel || "",
      language: u.language || "en",
      description: u.description || u.bio || "",
    });

    try {
      const res = await api.get(`/users/${u.id}/`);
      const fresh = extractUserObject(res.data);
      if (fresh && fresh.id) {
        const mergedRole = fresh.role || u.role || "user";
        setEditUserTarget((prev) =>
          prev?.id === u.id ? { ...u, ...fresh, role: mergedRole } : prev
        );
        setModalRole(mergedRole);
        const fFirst = fresh.first_name ?? u.first_name ?? "";
        const fLast = fresh.last_name ?? u.last_name ?? "";
        setEditForm({
          first_name: !String(fFirst).includes("@") ? fFirst : "",
          last_name: !String(fLast).includes("@") ? fLast : "",
          email: fresh.email ?? u.email ?? "",
          phone_number: fresh.phone_number ?? u.phone_number ?? "",
          country: fresh.country ?? u.country ?? "",
          skillLevel: fresh.skillLevel ?? u.skillLevel ?? "",
          language: fresh.language ?? u.language ?? "en",
          description: fresh.description ?? fresh.bio ?? u.description ?? "",
        });
      }
    } catch {
      // keep existing row fields
    }
  };

  const handleSaveUserEdit = async (e) => {
    e.preventDefault();
    if (!editUserTarget) return;
    setEditError("");
    setEditSaving(true);
    try {
      const payload = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        email: editForm.email.trim(),
        phone_number: editForm.phone_number.trim() || null,
        country: editForm.country.trim() || null,
        language: editForm.language || "en",
        description: editForm.description.trim() || null,
      };
      if (editForm.skillLevel) {
        payload.skillLevel = editForm.skillLevel;
      }

      const res = await api.patch(`/users/${editUserTarget.id}/`, payload);
      const updated = extractUserObject(res.data) || {
        ...editUserTarget,
        ...payload,
      };
      setUsers((prev) =>
        prev.map((item) =>
          item.id === editUserTarget.id ? { ...item, ...updated } : item
        )
      );
      setNotice(`Saved changes for ${getUserDisplayName(updated)}.`);
      setEditUserTarget(null);
    } catch (err) {
      setEditError(formatUserApiError(err, "Failed to update user details."));
    } finally {
      setEditSaving(false);
    }
  };

  // 4. Handle Change Password (`POST /users/{id}/change-password/`)
  const openPasswordModal = (u) => {
    setPwdTarget(u);
    setPwdForm({
      old_password: "",
      new_password: "",
      confirm_new_password: "",
    });
    setPwdError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!pwdTarget) return;
    setPwdError("");

    if (!pwdForm.new_password || !pwdForm.confirm_new_password) {
      setPwdError("Please enter and confirm the new password.");
      return;
    }
    if (pwdForm.new_password !== pwdForm.confirm_new_password) {
      setPwdError("New password and confirm password do not match.");
      return;
    }

    setPwdSaving(true);
    try {
      const res = await api.post(`/users/${pwdTarget.id}/change-password/`, {
        old_password: pwdForm.old_password.trim() || "string",
        new_password: pwdForm.new_password,
        confirm_new_password: pwdForm.confirm_new_password,
      });
      setNotice(
        res.data?.message ||
          `Password updated for ${getUserDisplayName(pwdTarget)}.`
      );
      setPwdTarget(null);
    } catch (err) {
      setPwdError(formatUserApiError(err, "Failed to change password."));
    } finally {
      setPwdSaving(false);
    }
  };

  // 5. Lookup User by Email or Phone (`POST /users/lookup/`)
  const handleLookupSubmit = async (e) => {
    e.preventDefault();
    setLookupError("");
    setLookupResult(null);
    const trimmed = lookupIdentifier.trim();
    if (!trimmed) {
      setLookupError("Enter an email address or phone number to look up.");
      return;
    }
    setLookupLoading(true);
    try {
      const res = await api.post("/users/lookup/", { identifier: trimmed });
      const found = extractUserObject(res.data);
      setLookupResult(found);
      if (found && found.id) {
        setUsers((prev) => {
          if (prev.some((u) => Number(u.id) === Number(found.id))) return prev;
          return [found, ...prev];
        });
      }
    } catch (err) {
      setLookupError(
        formatUserApiError(err, "No user found with that email or phone number.")
      );
    } finally {
      setLookupLoading(false);
    }
  };

  // 6. Delete User (`DELETE /users/{id}/`)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    setError("");
    try {
      await api.delete(`/users/${deleteTarget.id}/`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setServerTotalCount((prev) => (prev && prev > 0 ? prev - 1 : prev));
      setNotice(`Account "${getUserDisplayName(deleteTarget)}" was deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      setError(formatUserApiError(err, "Failed to delete user account."));
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const renderAvatar = (u) => {
    const imgUrl = u.profile_picture_url || u.profile_image;
    const isValidUrl =
      imgUrl &&
      typeof imgUrl === "string" &&
      !imgUrl.includes("via.placeholder.com") &&
      !brokenAvatars[u.id];

    if (isValidUrl) {
      return (
        <img
          src={imgUrl}
          alt={getUserDisplayName(u)}
          className="usr-avatar"
          onError={() =>
            setBrokenAvatars((prev) => ({ ...prev, [u.id]: true }))
          }
        />
      );
    }
    const toneIdx = getAvatarToneIndex(u);
    return (
      <div className={`usr-avatar-fallback usr-avatar-tone-${toneIdx}`}>
        {getUserInitials(u)}
      </div>
    );
  };

  return (
    <div className="usr-page">
      {/* Header */}
      <div className="usr-header">
        <div>
          <h1 className="usr-title">
            Users & Access
            {syncingPages && (
              <span className="usr-sync-pill">
                Syncing directory ({syncProgress.loadedPages}/
                {syncProgress.totalPages})
              </span>
            )}
          </h1>
          <p className="usr-subtitle">
            Browse registered members, filter by role or signup date, and manage account permissions.
          </p>
        </div>

        <div className="usr-header-actions">
          <button
            type="button"
            className="usr-btn usr-btn-secondary"
            onClick={() => {
              setLookupIdentifier("");
              setLookupResult(null);
              setLookupError("");
              setLookupOpen(true);
            }}
          >
            <Search size={15} />
            Find by Email / Phone
          </button>

          <button
            type="button"
            className="usr-btn usr-btn-secondary"
            onClick={() => fetchUsers(true, dateFilter)}
            disabled={loading || syncingPages}
          >
            <RefreshCw size={15} />
            {syncingPages ? "Syncing..." : "Refresh"}
          </button>

          <button
            type="button"
            className="usr-btn usr-btn-primary"
            onClick={() => {
              setCreateError("");
              setCreateOpen(true);
            }}
          >
            <UserPlus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="usr-alert error">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={17} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="usr-btn usr-btn-xs usr-btn-secondary"
            onClick={() => setError("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="usr-alert success">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={17} />
            <span>{notice}</span>
          </div>
          <button
            type="button"
            className="usr-btn usr-btn-xs usr-btn-secondary"
            onClick={() => setNotice("")}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="usr-kpi-grid">
        <div
          className={`usr-kpi-card${
            roleFilter === "all" && dateFilter === "all" ? " active-filter" : ""
          }`}
          onClick={() => {
            setRoleFilter("all");
            setDateFilter("all");
            setSearch("");
          }}
        >
          <div>
            <div className="usr-kpi-label">
              {dateFilter === "today"
                ? "People Today"
                : dateFilter === "week"
                ? "People This Week"
                : dateFilter === "month"
                ? "People This Month"
                : hasActiveFilter
                ? "Matching Accounts"
                : "Total Accounts"}
            </div>
            <div className="usr-kpi-value">
              {loading && !stats.total
                ? "—"
                : (dateFilter !== "all" && roleFilter === "all" && !search.trim()
                    ? stats.dateCount
                    : displayedMatchCount
                  ).toLocaleString()}
            </div>
            <div className="usr-kpi-sub">
              {hasActiveFilter
                ? `Out of ${stats.total.toLocaleString()} total registered`
                : "All registered accounts"}
            </div>
          </div>
          <div className="usr-kpi-icon">
            <Users size={19} />
          </div>
        </div>

        <div
          className={`usr-kpi-card${
            roleFilter === "user" ? " active-filter" : ""
          }`}
          onClick={() =>
            setRoleFilter(roleFilter === "user" ? "all" : "user")
          }
        >
          <div>
            <div className="usr-kpi-label">
              {dateFilter !== "all"
                ? `Active (${activeDateOption.shortLabel})`
                : "Active Accounts"}
            </div>
            <div className="usr-kpi-value">
              {loading ? "—" : stats.active.toLocaleString()}
            </div>
            <div className="usr-kpi-sub">
              {stats.mau !== null
                ? `${Number(stats.mau).toLocaleString()} active this month`
                : "Enabled for sign-in"}
            </div>
          </div>
          <div className="usr-kpi-icon indigo">
            <UserCheck size={19} />
          </div>
        </div>

        <div
          className={`usr-kpi-card${
            roleFilter === "adminGroup" ||
            roleFilter === "admin" ||
            roleFilter === "superAdmin"
              ? " active-filter"
              : ""
          }`}
          onClick={() =>
            setRoleFilter(roleFilter === "adminGroup" ? "all" : "adminGroup")
          }
        >
          <div>
            <div className="usr-kpi-label">Admins & Super Admins</div>
            <div className="usr-kpi-value">{loading ? "—" : stats.admins}</div>
            <div className="usr-kpi-sub">Elevated platform privileges</div>
          </div>
          <div className="usr-kpi-icon amber">
            <ShieldCheck size={19} />
          </div>
        </div>

        <div
          className={`usr-kpi-card${
            roleFilter === "creator" ? " active-filter" : ""
          }`}
          onClick={() =>
            setRoleFilter(roleFilter === "creator" ? "all" : "creator")
          }
        >
          <div>
            <div className="usr-kpi-label">Verified Creators</div>
            <div className="usr-kpi-value">{loading ? "—" : stats.creators}</div>
            <div className="usr-kpi-sub">Approved recipe creators</div>
          </div>
          <div className="usr-kpi-icon violet">
            <Star size={19} />
          </div>
        </div>
      </div>

      {/* Role Filter (All Roles, Super Admin, Admin, Creator, Rider, User) + Date Filter (Today, Week, Month, All Time) + Search */}
      <div className="usr-toolbar">
        <div className="usr-toolbar-left">
          <div className="usr-filter-pills" role="group" aria-label="Filter users by role">
            {ROLE_FILTER_OPTIONS.map((tab) => {
              const roleCount = stats.roleCounts?.[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`usr-filter-pill${
                    roleFilter === tab.key ? " active" : ""
                  }`}
                  onClick={() => setRoleFilter(tab.key)}
                >
                  <span>{tab.label}</span>
                  {!loading && roleCount !== undefined && (
                    <span className="usr-pill-count">
                      {roleCount.toLocaleString()}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="usr-search-wrap">
            <Search size={15} className="usr-search-icon" />
            <input
              type="text"
              className="usr-search-input"
              placeholder="Search by name, email, phone, or country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="usr-search-clear"
                onClick={() => setSearch("")}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="usr-toolbar-right">
          {!loading && (
            <div className="usr-filter-count-badge" aria-live="polite">
              <strong>{displayedMatchCount.toLocaleString()}</strong>{" "}
              {displayedMatchCount === 1 ? "person" : "people"}
              {dateFilter === "today"
                ? " today"
                : dateFilter === "week"
                ? " this week"
                : dateFilter === "month"
                ? " this month"
                : ""}
            </div>
          )}

          <select
            className="usr-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by date range"
          >
            {DATE_FILTER_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            className="usr-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort users"
          >
            <option value="newest">Sort: Newest First</option>
            <option value="oldest">Sort: Oldest First</option>
            <option value="name-asc">Sort: Name (A–Z)</option>
            <option value="name-desc">Sort: Name (Z–A)</option>
          </select>

          <div className="usr-filter-pills">
            <button
              type="button"
              className={`usr-filter-pill${viewMode === "table" ? " active" : ""}`}
              onClick={() => setViewMode("table")}
            >
              <List size={14} />
              List
            </button>
            <button
              type="button"
              className={`usr-filter-pill${viewMode === "cards" ? " active" : ""}`}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid size={14} />
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* Live Filter Results Summary Strip */}
      {!loading && hasActiveFilter && (
        <div className="usr-results-summary-bar">
          <div className="usr-results-summary-text">
            Showing{" "}
            <strong>
              {displayedMatchCount.toLocaleString()}{" "}
              {displayedMatchCount === 1 ? "person" : "people"}
            </strong>
            {dateFilter !== "all" && (
              <span>
                {" "}
                for <strong>{activeDateOption.shortLabel}</strong>
              </span>
            )}
            {roleFilter !== "all" && (
              <span>
                {" "}
                • Role:{" "}
                <strong>
                  {roleFilter === "adminGroup"
                    ? "Admins & Super Admins"
                    : getRoleLabel(roleFilter)}
                </strong>
              </span>
            )}
            {search.trim() && (
              <span>
                {" "}
                • Search: <strong>"{search.trim()}"</strong>
              </span>
            )}
          </div>
          <button
            type="button"
            className="usr-btn usr-btn-xs usr-btn-secondary"
            onClick={() => {
              setDateFilter("all");
              setRoleFilter("all");
              setSearch("");
            }}
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Loading Shimmer State */}
      {loading ? (
        <div className="usr-table-card">
          <div className="usr-table-scroll">
            <table className="usr-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Location & Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="usr-identity">
                        <div
                          className="usr-shimmer"
                          style={{ width: 38, height: 38, borderRadius: "50%" }}
                        />
                        <div>
                          <div
                            className="usr-shimmer"
                            style={{ width: 140, height: 14, marginBottom: 6 }}
                          />
                          <div
                            className="usr-shimmer"
                            style={{ width: 180, height: 11 }}
                          />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div
                        className="usr-shimmer"
                        style={{ width: 110, height: 13, marginBottom: 5 }}
                      />
                      <div className="usr-shimmer" style={{ width: 80, height: 11 }} />
                    </td>
                    <td>
                      <div
                        className="usr-shimmer"
                        style={{ width: 74, height: 24, borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      <div
                        className="usr-shimmer"
                        style={{ width: 64, height: 18, borderRadius: 6 }}
                      />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div
                        className="usr-shimmer"
                        style={{
                          width: 120,
                          height: 30,
                          borderRadius: 8,
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
      ) : filteredUsers.length === 0 ? (
        <div className="usr-empty">
          <div className="usr-empty-icon">
            <Users size={24} />
          </div>
          <h3 style={{ margin: 0, fontSize: "1.02rem" }}>
            {syncingPages
              ? "Searching across all user pages..."
              : "No matching accounts found"}
          </h3>
          <p style={{ margin: 0, fontSize: "0.84rem", color: "#64748b" }}>
            {syncingPages
              ? `Loaded ${stats.loadedCount} accounts so far...`
              : "Try resetting your role or date filter, or search for an exact email or phone number."}
          </p>
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button
              type="button"
              className="usr-btn usr-btn-secondary"
              onClick={() => {
                setSearch("");
                setRoleFilter("all");
                setDateFilter("all");
              }}
            >
              Reset Filters
            </button>
            <button
              type="button"
              className="usr-btn usr-btn-primary"
              onClick={() => {
                setLookupIdentifier(search);
                setLookupResult(null);
                setLookupError("");
                setLookupOpen(true);
              }}
            >
              <Search size={14} />
              Find by Email / Phone
            </button>
          </div>
        </div>
      ) : viewMode === "table" ? (
        <div className="usr-table-card">
          <div className="usr-table-scroll">
            <table className="usr-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Location & Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => {
                  const isActive = u.is_active !== false;
                  const currentRole = u.role || "user";

                  return (
                    <tr key={u.id} onClick={() => openEditUserModal(u)}>
                      <td>
                        <div className="usr-identity">
                          {renderAvatar(u)}
                          <div>
                            <div className="usr-name">{getUserDisplayName(u)}</div>
                            <div className="usr-email">{u.email || "—"}</div>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="usr-contact-cell">
                          {u.country ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Globe size={13} style={{ color: "#94a3b8" }} />
                              {u.country}
                            </span>
                          ) : null}
                          {u.phone_number ? (
                            <span
                              className="usr-contact-sub"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                              }}
                            >
                              <Phone size={12} style={{ color: "#94a3b8" }} />
                              {u.phone_number}
                            </span>
                          ) : null}
                          {!u.country && !u.phone_number && (
                            <span style={{ color: "#94a3b8" }}>—</span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span className={`usr-role-badge ${currentRole}`}>
                          {getRoleLabel(currentRole)}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`usr-status-indicator ${
                            isActive ? "active" : "inactive"
                          }`}
                        >
                          <span className="usr-status-dot" />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td
                        style={{ textAlign: "right" }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            justifyContent: "flex-end",
                          }}
                        >
                          <button
                            type="button"
                            className="usr-btn usr-btn-secondary usr-btn-sm"
                            onClick={() => openEditUserModal(u)}
                            title="View profile, change role, or edit details"
                          >
                            <SlidersHorizontal size={13} />
                            Manage
                          </button>

                          <button
                            type="button"
                            className="usr-btn usr-btn-secondary usr-btn-sm"
                            onClick={() => openPasswordModal(u)}
                            title="Reset password"
                          >
                            <KeyRound size={13} />
                            Password
                          </button>

                          <button
                            type="button"
                            className="usr-btn usr-btn-ghost usr-btn-sm"
                            onClick={() => setDeleteTarget(u)}
                            title="Delete account"
                            style={{ color: "#94a3b8", padding: "6px 8px" }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="usr-pagination">
            <div className="usr-pagination-info">
              Showing{" "}
              <strong>
                {(currentPage - 1) * usersPerPage + 1}–
                {Math.min(currentPage * usersPerPage, filteredUsers.length)}
              </strong>{" "}
              of <strong>{filteredUsers.length.toLocaleString()}</strong> accounts
            </div>

            {totalPages > 1 && (
              <div className="usr-pagination-controls">
                <button
                  type="button"
                  className="usr-btn usr-btn-secondary usr-btn-sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    padding: "0 8px",
                    color: "#475569",
                  }}
                >
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  className="usr-btn usr-btn-secondary usr-btn-sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grid View (No User ID on cards) */
        <>
          <div className="usr-grid">
            {paginatedUsers.map((u) => {
              const isActive = u.is_active !== false;
              const currentRole = u.role || "user";
              return (
                <div
                  key={u.id}
                  className="usr-card"
                  onClick={() => openEditUserModal(u)}
                >
                  <div>
                    <div className="usr-card-top">
                      <div className="usr-identity">
                        {renderAvatar(u)}
                        <div>
                          <div className="usr-name">{getUserDisplayName(u)}</div>
                          <div className="usr-email">{u.email}</div>
                        </div>
                      </div>
                      <span className={`usr-role-badge ${currentRole}`}>
                        {getRoleLabel(currentRole)}
                      </span>
                    </div>

                    <div className="usr-card-meta" style={{ marginTop: 12 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Location:</span>
                        <strong>{u.country || "—"}</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>Phone:</span>
                        <strong>{u.phone_number || "—"}</strong>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>Status:</span>
                        <span
                          className={`usr-status-indicator ${
                            isActive ? "active" : "inactive"
                          }`}
                          style={{ fontSize: "0.78rem" }}
                        >
                          <span className="usr-status-dot" />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className="usr-card-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="usr-btn usr-btn-secondary usr-btn-sm"
                      onClick={() => openEditUserModal(u)}
                    >
                      <SlidersHorizontal size={13} />
                      Manage
                    </button>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className="usr-btn usr-btn-secondary usr-btn-sm"
                        onClick={() => openPasswordModal(u)}
                      >
                        <KeyRound size={13} />
                        Password
                      </button>
                      <button
                        type="button"
                        className="usr-btn usr-btn-ghost usr-btn-sm"
                        onClick={() => setDeleteTarget(u)}
                        style={{ color: "#94a3b8" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div
              className="usr-pagination"
              style={{
                marginTop: 16,
                borderRadius: 12,
                border: "1px solid #e2e8f0",
              }}
            >
              <div className="usr-pagination-info">
                Page {currentPage} of {totalPages} (
                {filteredUsers.length.toLocaleString()} accounts)
              </div>
              <div className="usr-pagination-controls">
                <button
                  type="button"
                  className="usr-btn usr-btn-secondary usr-btn-sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="usr-btn usr-btn-secondary usr-btn-sm"
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===================================================================
          MODAL 1: CREATE NEW USER (`POST /users/`)
      =================================================================== */}
      {createOpen && (
        <div
          className="usr-modal-backdrop"
          onClick={() => !createSaving && setCreateOpen(false)}
        >
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <h3>
                <UserPlus size={18} />
                Add New User
              </h3>
              <button
                type="button"
                className="usr-modal-close"
                onClick={() => !createSaving && setCreateOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser}>
              <div className="usr-modal-body">
                {createError && (
                  <div className="usr-alert error" style={{ marginBottom: 0 }}>
                    <span>{createError}</span>
                  </div>
                )}

                <div className="usr-form-grid">
                  <div className="usr-form-group">
                    <label className="usr-label">First Name *</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="e.g. Chima"
                      value={createForm.first_name}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          first_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Last Name *</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="e.g. Okolo"
                      value={createForm.last_name}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          last_name: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="usr-form-group full">
                    <label className="usr-label">Email Address *</label>
                    <input
                      type="email"
                      className="usr-input"
                      placeholder="name@example.com"
                      value={createForm.email}
                      onChange={(e) =>
                        setCreateForm((p) => ({ ...p, email: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="usr-form-group full">
                    <label className="usr-label">
                      Password * (at least 6 characters)
                    </label>
                    <input
                      type="password"
                      autoComplete="new-password"
                      className="usr-input"
                      placeholder="Enter initial password..."
                      value={createForm.password}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          password: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Phone Number</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="+234..."
                      value={createForm.phone_number}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          phone_number: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Country</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="e.g. Nigeria"
                      value={createForm.country}
                      onChange={(e) =>
                        setCreateForm((p) => ({
                          ...p,
                          country: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="usr-modal-footer">
                <div />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="usr-btn usr-btn-secondary"
                    onClick={() => setCreateOpen(false)}
                    disabled={createSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="usr-btn usr-btn-primary"
                    disabled={createSaving}
                  >
                    {createSaving ? "Creating..." : "Create Account"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 2: USER DETAILS, ROLE & PROFILE MANAGEMENT
          (User ID is shown here on the detail view as requested)
      =================================================================== */}
      {editUserTarget && (
        <div
          className="usr-modal-backdrop"
          onClick={() => !editSaving && !modalRoleSaving && setEditUserTarget(null)}
        >
          <div className="usr-modal wide" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <h3>Account Details</h3>
              <button
                type="button"
                className="usr-modal-close"
                onClick={() =>
                  !editSaving && !modalRoleSaving && setEditUserTarget(null)
                }
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveUserEdit}>
              <div className="usr-modal-body">
                {editError && (
                  <div className="usr-alert error" style={{ marginBottom: 0 }}>
                    <span>{editError}</span>
                  </div>
                )}

                {/* Identity Header Banner */}
                <div className="usr-detail-banner">
                  <div className="usr-identity">
                    {renderAvatar(editUserTarget)}
                    <div>
                      <div className="usr-name" style={{ fontSize: "1rem" }}>
                        {getUserDisplayName(editUserTarget)}
                      </div>
                      <div className="usr-email">{editUserTarget.email}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className={`usr-role-badge ${
                        editUserTarget.role || "user"
                      }`}
                    >
                      {getRoleLabel(editUserTarget.role)}
                    </span>
                  </div>
                </div>

                {/* Read-only Metadata Grid (Includes User ID here on detail page) */}
                <div className="usr-detail-meta-grid">
                  <div className="usr-detail-meta-item">
                    <div className="usr-detail-meta-label">User ID</div>
                    <div className="usr-detail-meta-value">
                      #{editUserTarget.id}
                    </div>
                  </div>
                  <div className="usr-detail-meta-item">
                    <div className="usr-detail-meta-label">Account Status</div>
                    <div className="usr-detail-meta-value">
                      {editUserTarget.is_active !== false ? "Active" : "Inactive"}
                    </div>
                  </div>
                  <div className="usr-detail-meta-item">
                    <div className="usr-detail-meta-label">Referral Code</div>
                    <div className="usr-detail-meta-value">
                      {editUserTarget.referral_code || "—"}
                    </div>
                  </div>
                  <div className="usr-detail-meta-item">
                    <div className="usr-detail-meta-label">Joined</div>
                    <div className="usr-detail-meta-value">
                      {editUserTarget.date_joined || editUserTarget.created_at
                        ? new Date(
                            editUserTarget.date_joined ||
                              editUserTarget.created_at
                          ).toLocaleDateString()
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Clear Role & Access Level Box */}
                <div className="usr-role-box">
                  <div>
                    <div
                      style={{
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      Account Role & Permissions
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#64748b",
                        marginTop: 2,
                      }}
                    >
                      Choose what level of access this person has on Cookeaze.
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <select
                      className="usr-select"
                      value={modalRole}
                      onChange={(e) => setModalRole(e.target.value)}
                      disabled={modalRoleSaving}
                    >
                      <option value="user">User (Standard Account)</option>
                      <option value="creator">Creator</option>
                      <option value="admin">Admin</option>
                      <option value="superAdmin">Super Admin</option>
                    </select>
                    <button
                      type="button"
                      className="usr-btn usr-btn-secondary usr-btn-sm"
                      onClick={handleModalRoleUpdate}
                      disabled={
                        modalRoleSaving ||
                        modalRole === (editUserTarget.role || "user")
                      }
                    >
                      {modalRoleSaving ? "Updating..." : "Update Role"}
                    </button>
                  </div>
                </div>

                {/* Editable Profile Fields */}
                <div className="usr-form-grid">
                  <div className="usr-form-group">
                    <label className="usr-label">First Name</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="First name"
                      value={editForm.first_name}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          first_name: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Last Name</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="Last name"
                      value={editForm.last_name}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          last_name: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Email Address</label>
                    <input
                      type="email"
                      className="usr-input"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, email: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Phone Number</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="Not provided"
                      value={editForm.phone_number}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          phone_number: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Country</label>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="Not provided"
                      value={editForm.country}
                      onChange={(e) =>
                        setEditForm((p) => ({ ...p, country: e.target.value }))
                      }
                    />
                  </div>

                  <div className="usr-form-group">
                    <label className="usr-label">Cooking Experience</label>
                    <select
                      className="usr-input"
                      value={editForm.skillLevel}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          skillLevel: e.target.value,
                        }))
                      }
                    >
                      <option value="">Not specified</option>
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                      <option value="Expert">Expert</option>
                    </select>
                  </div>

                  <div className="usr-form-group full">
                    <label className="usr-label">Bio / Notes</label>
                    <textarea
                      rows={2}
                      className="usr-textarea"
                      placeholder="No bio added"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="usr-modal-footer">
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    className="usr-btn usr-btn-secondary usr-btn-sm"
                    onClick={() => {
                      const target = editUserTarget;
                      setEditUserTarget(null);
                      openPasswordModal(target);
                    }}
                  >
                    <KeyRound size={13} />
                    Reset Password
                  </button>
                  <button
                    type="button"
                    className="usr-btn usr-btn-danger-soft usr-btn-sm"
                    onClick={() => {
                      const target = editUserTarget;
                      setEditUserTarget(null);
                      setDeleteTarget(target);
                    }}
                  >
                    <Trash2 size={13} />
                    Delete Account
                  </button>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="usr-btn usr-btn-secondary"
                    onClick={() => setEditUserTarget(null)}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="usr-btn usr-btn-primary"
                    disabled={editSaving}
                  >
                    {editSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 3: CHANGE USER PASSWORD (`POST /users/{id}/change-password/`)
      =================================================================== */}
      {pwdTarget && (
        <div
          className="usr-modal-backdrop"
          onClick={() => !pwdSaving && setPwdTarget(null)}
        >
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <h3>
                <KeyRound size={18} />
                Reset Password — {getUserDisplayName(pwdTarget)}
              </h3>
              <button
                type="button"
                className="usr-modal-close"
                onClick={() => !pwdSaving && setPwdTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handlePasswordSubmit}>
              <div className="usr-modal-body">
                {pwdError && (
                  <div className="usr-alert error" style={{ marginBottom: 0 }}>
                    <span>{pwdError}</span>
                  </div>
                )}

                <div className="usr-form-group">
                  <label className="usr-label">New Password *</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="usr-input"
                    placeholder="Enter new password..."
                    value={pwdForm.new_password}
                    onChange={(e) =>
                      setPwdForm((p) => ({
                        ...p,
                        new_password: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="usr-form-group">
                  <label className="usr-label">Confirm New Password *</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="usr-input"
                    placeholder="Re-enter new password..."
                    value={pwdForm.confirm_new_password}
                    onChange={(e) =>
                      setPwdForm((p) => ({
                        ...p,
                        confirm_new_password: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="usr-form-group">
                  <label className="usr-label">
                    Current Password (Optional)
                  </label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className="usr-input"
                    placeholder="Leave blank for admin reset..."
                    value={pwdForm.old_password}
                    onChange={(e) =>
                      setPwdForm((p) => ({
                        ...p,
                        old_password: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="usr-modal-footer">
                <div />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="usr-btn usr-btn-secondary"
                    onClick={() => setPwdTarget(null)}
                    disabled={pwdSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="usr-btn usr-btn-primary"
                    disabled={pwdSaving}
                  >
                    {pwdSaving ? "Updating..." : "Update Password"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 4: LOOKUP USER BY EMAIL OR PHONE (`POST /users/lookup/`)
      =================================================================== */}
      {lookupOpen && (
        <div
          className="usr-modal-backdrop"
          onClick={() => !lookupLoading && setLookupOpen(false)}
        >
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <h3>
                <Search size={18} />
                Find Account by Email or Phone
              </h3>
              <button
                type="button"
                className="usr-modal-close"
                onClick={() => !lookupLoading && setLookupOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleLookupSubmit}>
              <div className="usr-modal-body">
                {lookupError && (
                  <div className="usr-alert error" style={{ marginBottom: 0 }}>
                    <span>{lookupError}</span>
                  </div>
                )}

                <div className="usr-form-group">
                  <label className="usr-label">
                    Email Address or Phone Number
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      className="usr-input"
                      placeholder="e.g. name@example.com or +2348012345678"
                      value={lookupIdentifier}
                      onChange={(e) => setLookupIdentifier(e.target.value)}
                      required
                    />
                    <button
                      type="submit"
                      className="usr-btn usr-btn-primary"
                      disabled={lookupLoading}
                    >
                      {lookupLoading ? "Searching..." : "Search"}
                    </button>
                  </div>
                </div>

                {lookupResult && (
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      padding: 14,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div className="usr-identity">
                        {renderAvatar(lookupResult)}
                        <div>
                          <div className="usr-name">
                            {getUserDisplayName(lookupResult)}
                          </div>
                          <div className="usr-email">{lookupResult.email}</div>
                        </div>
                      </div>
                      <span
                        className={`usr-role-badge ${
                          lookupResult.role || "user"
                        }`}
                      >
                        {getRoleLabel(lookupResult.role)}
                      </span>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        marginTop: 12,
                        justifyContent: "flex-end",
                      }}
                    >
                      <button
                        type="button"
                        className="usr-btn usr-btn-secondary usr-btn-sm"
                        onClick={() => {
                          const target = lookupResult;
                          setLookupOpen(false);
                          openEditUserModal(target);
                        }}
                      >
                        Open Account Details
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="usr-modal-footer">
                <div />
                <button
                  type="button"
                  className="usr-btn usr-btn-secondary"
                  onClick={() => setLookupOpen(false)}
                >
                  Close
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================
          MODAL 5: DELETE USER CONFIRMATION (`DELETE /users/{id}/`)
      =================================================================== */}
      {deleteTarget && (
        <div
          className="usr-modal-backdrop"
          onClick={() => !deleteSubmitting && setDeleteTarget(null)}
        >
          <div className="usr-modal" onClick={(e) => e.stopPropagation()}>
            <div className="usr-modal-header">
              <h3 style={{ color: "#e11d48" }}>
                <Trash2 size={18} />
                Delete User Account
              </h3>
              <button
                type="button"
                className="usr-modal-close"
                onClick={() => !deleteSubmitting && setDeleteTarget(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="usr-modal-body">
              <p style={{ margin: 0, fontSize: "0.88rem", lineHeight: 1.55 }}>
                Are you sure you want to permanently delete{" "}
                <strong>{getUserDisplayName(deleteTarget)}</strong> (
                <code>{deleteTarget.email}</code>)? This action cannot be undone.
              </p>
            </div>

            <div className="usr-modal-footer">
              <div />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  className="usr-btn usr-btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="usr-btn usr-btn-danger"
                  onClick={handleConfirmDelete}
                  disabled={deleteSubmitting}
                >
                  <Trash2 size={15} />
                  {deleteSubmitting ? "Deleting..." : "Delete Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
