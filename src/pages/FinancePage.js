// src/pages/FinancePage.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Search,
  X,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./FinancePage.css";

const REJECTION_REASON_PRESETS = [
  "Bank account details could not be verified.",
  "Account holder name does not match profile.",
  "Duplicate withdrawal request submitted.",
  "Insufficient cleared wallet balance.",
];

const FINANCIAL_CATEGORY_CONFIG = [
  {
    key: "funding",
    aliases: ["funding", "wallet_funding", "total_funding", "deposits", "top_ups"],
    title: "Funding",
  },
  {
    key: "payments",
    aliases: ["payments", "total_payments", "order_payments", "purchases"],
    title: "Payments",
  },
  {
    key: "settlements",
    aliases: [
      "settlements",
      "total_settlements",
      "creator_settlements",
      "rider_settlements",
      "payout_settlements",
    ],
    title: "Settlements",
  },
  {
    key: "withdrawals",
    aliases: ["withdrawals", "total_withdrawals", "payouts"],
    title: "Withdrawals",
  },
  {
    key: "fees",
    aliases: [
      "fees",
      "platform_fees",
      "service_fees",
      "service_charges",
      "commissions",
      "total_fees",
    ],
    title: "Platform Fees",
  },
  {
    key: "refunds",
    aliases: ["refunds", "total_refunds", "order_refunds"],
    title: "Refunds",
  },
  {
    key: "disputes",
    aliases: ["disputes", "dispute_refunds", "total_disputes", "dispute_resolutions"],
    title: "Disputes",
  },
  {
    key: "compensation",
    aliases: ["compensation", "compensations", "total_compensation", "bonuses", "credits"],
    title: "Compensation",
  },
];

const DISPUTE_RESOLUTION_OPTIONS = [
  { value: "CREATOR_AT_FAULT", label: "Creator at Fault" },
  { value: "RIDER_AT_FAULT", label: "Rider at Fault" },
  { value: "COOKEAZE_AT_FAULT", label: "Cookeaze at Fault" },
  { value: "BUYER_AT_FAULT", label: "Buyer at Fault (No Refund)" },
  { value: "SHARED_FAULT", label: "Shared Fault" },
];

const DISPUTE_RESOLVE_REASON_OPTIONS = [
  { value: "WRONG_ITEM", label: "Wrong Item" },
  { value: "MISSING_ITEM", label: "Missing Item" },
  { value: "POOR_QUALITY", label: "Poor Quality" },
  { value: "DAMAGED_ITEM", label: "Damaged Item" },
  { value: "LATE_DELIVERY", label: "Late Delivery" },
  { value: "DELIVERY_FAILURE", label: "Delivery Failure" },
  { value: "ORDER_NOT_RECEIVED", label: "Order Not Received" },
  { value: "FOOD_SAFETY_CONCERN", label: "Food Safety Concern" },
  { value: "OTHER", label: "Other" },
];

const DISPUTE_FILTER_REASON_OPTIONS = [
  { value: "", label: "All Reasons" },
  { value: "wrong_item", label: "Wrong Item" },
  { value: "missing_item", label: "Missing Item" },
  { value: "damaged", label: "Damaged" },
  { value: "cold_food", label: "Cold Food" },
  { value: "never_received", label: "Never Received" },
  { value: "quality", label: "Quality" },
  { value: "other", label: "Other" },
];

const DISPUTE_FILTER_RESOLUTION_OPTIONS = [
  { value: "", label: "All Fault Decisions" },
  { value: "CREATOR_AT_FAULT", label: "Creator at Fault" },
  { value: "RIDER_AT_FAULT", label: "Rider at Fault" },
  { value: "COOKEAZE_AT_FAULT", label: "Cookeaze at Fault" },
  { value: "BUYER_AT_FAULT", label: "Buyer at Fault" },
  { value: "SHARED_FAULT", label: "Shared Fault" },
];

function mapBuyerReasonToResolveReason(buyerReason) {
  const map = {
    wrong_item: "WRONG_ITEM",
    missing_item: "MISSING_ITEM",
    damaged: "DAMAGED_ITEM",
    cold_food: "POOR_QUALITY",
    never_received: "ORDER_NOT_RECEIVED",
    quality: "POOR_QUALITY",
    other: "OTHER",
  };
  return map[String(buyerReason || "").toLowerCase()] || "WRONG_ITEM";
}

function unwrapPayload(resOrData) {
  const root = resOrData?.data !== undefined ? resOrData.data : resOrData;
  if (!root || typeof root !== "object") return root;
  if (
    root.data !== undefined &&
    root.data !== null &&
    typeof root.data === "object" &&
    !Array.isArray(root.data)
  ) {
    return root.data;
  }
  return root;
}

function extractPaginatedList(resOrData, arrayKeys = []) {
  const root = resOrData?.data !== undefined ? resOrData.data : resOrData;
  if (!root) return { items: [], count: 0, totalPages: 1 };

  if (Array.isArray(root)) {
    return { items: root, count: root.length, totalPages: 1 };
  }

  const inner =
    root.data && typeof root.data === "object" && !Array.isArray(root.data)
      ? root.data
      : root;

  let list = [];
  for (const k of ["results", ...arrayKeys, "items", "data"]) {
    if (Array.isArray(inner[k])) {
      list = inner[k];
      break;
    }
    if (Array.isArray(root[k])) {
      list = root[k];
      break;
    }
  }

  const count = Number(
    inner.count ??
      inner.total ??
      inner.total_count ??
      root.count ??
      root.pagination?.total ??
      root.pagination?.count ??
      list.length
  );

  const pageSize = Number(
    inner.page_size ?? root.page_size ?? root.pagination?.page_size ?? 20
  );

  const explicitPages = Number(
    inner.total_pages ??
      inner.num_pages ??
      root.total_pages ??
      root.pagination?.total_pages ??
      0
  );

  const totalPages =
    explicitPages > 0
      ? explicitPages
      : Math.max(1, Math.ceil(count / Math.max(1, pageSize)));

  return { items: list, count, totalPages };
}

function formatNaira(val) {
  const num = Number(val);
  if (!Number.isFinite(num)) return "₦0.00";
  return `₦${num.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(dateStr) {
  if (!dateStr) return { date: "—", time: "" };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { date: String(dateStr), time: "" };
  return {
    date: d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function toTitleCaseName(str) {
  if (!str) return "—";
  const clean = String(str).trim();
  if (!clean) return "—";
  if (clean === clean.toUpperCase() && clean.length > 3) {
    return clean
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return clean;
}

function humanizeConstant(str) {
  if (!str) return "—";
  return String(str)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function shortenBankName(name) {
  if (!name) return "—";
  const clean = String(name).trim();
  if (/opay/i.test(clean)) return "OPay";
  if (/palmpay/i.test(clean)) return "PalmPay";
  if (/moniepoint/i.test(clean)) return "Moniepoint";
  if (/kuda/i.test(clean)) return "Kuda Bank";
  if (/guaranty trust/i.test(clean)) return "GTBank";
  if (/united bank for africa/i.test(clean)) return "UBA";
  if (/first city monument/i.test(clean)) return "FCMB";
  return clean;
}

function getInitials(name) {
  const clean = String(name || "U").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function parseFinancialMetric(statsObj, config) {
  if (!statsObj || typeof statsObj !== "object") {
    return { amount: 0, count: null };
  }

  const sources = [
    statsObj,
    statsObj.totals,
    statsObj.categories,
    statsObj.breakdown,
    statsObj.summary,
  ].filter((s) => s && typeof s === "object");

  let matchedVal = undefined;
  for (const src of sources) {
    for (const alias of config.aliases) {
      if (src[alias] !== undefined && src[alias] !== null) {
        matchedVal = src[alias];
        break;
      }
    }
    if (matchedVal !== undefined) break;
  }

  if (matchedVal === undefined) {
    for (const src of sources) {
      const amtKey = `${config.key}_amount`;
      const totKey = `${config.key}_total`;
      if (src[amtKey] !== undefined) {
        matchedVal = src[amtKey];
        break;
      }
      if (src[totKey] !== undefined) {
        matchedVal = src[totKey];
        break;
      }
    }
  }

  let explicitRootCount = null;
  for (const src of sources) {
    const cntKey = `${config.key}_count`;
    if (src[cntKey] !== undefined && src[cntKey] !== null) {
      explicitRootCount = Number(src[cntKey]);
      break;
    }
  }

  if (matchedVal === undefined || matchedVal === null) {
    return { amount: 0, count: explicitRootCount };
  }

  if (typeof matchedVal === "number" || typeof matchedVal === "string") {
    return {
      amount: Number(matchedVal) || 0,
      count: explicitRootCount,
    };
  }

  if (typeof matchedVal === "object" && !Array.isArray(matchedVal)) {
    const primaryAmount =
      matchedVal.total ??
      matchedVal.amount ??
      matchedVal.total_amount ??
      matchedVal.sum ??
      matchedVal.value ??
      matchedVal.net ??
      0;

    const countVal =
      matchedVal.count ??
      matchedVal.total_count ??
      matchedVal.transactions ??
      matchedVal.transaction_count ??
      explicitRootCount;

    return {
      amount: Number(primaryAmount) || 0,
      count:
        countVal !== null && countVal !== undefined ? Number(countVal) : null,
    };
  }

  return { amount: 0, count: explicitRootCount };
}

function normalizeWithdrawalItem(raw) {
  if (!raw || typeof raw !== "object") return null;

  const userObj =
    raw.creator && typeof raw.creator === "object"
      ? raw.creator
      : raw.user && typeof raw.user === "object"
      ? raw.user
      : raw.rider && typeof raw.rider === "object"
      ? raw.rider
      : null;

  const id = raw.id ?? raw.withdrawal_id ?? raw.request_id;
  const userName =
    raw.creator_name ||
    raw.user_name ||
    raw.full_name ||
    raw.rider_name ||
    userObj?.full_name ||
    userObj?.creator_name ||
    (userObj?.first_name
      ? `${userObj.first_name} ${userObj.last_name || ""}`.trim()
      : "") ||
    userObj?.username ||
    toTitleCaseName(raw.account_name) ||
    "User";

  const userEmail =
    raw.creator_email ||
    raw.user_email ||
    raw.email ||
    userObj?.email ||
    "";

  const rawRole =
    raw.role ||
    raw.user_role ||
    userObj?.role ||
    (raw.rider || raw.rider_id || raw.rider_name ? "Rider" : "Creator");
  const userRole =
    String(rawRole).charAt(0).toUpperCase() +
    String(rawRole).slice(1).toLowerCase();

  const amount = Number(raw.amount ?? raw.withdrawal_amount ?? 0);
  const fullBankName = raw.bank_name || raw.bank || "—";
  const bankName = shortenBankName(fullBankName);
  const bankCode = raw.bank_code || "";
  const accountNumber = raw.account_number || "—";
  const accountName = toTitleCaseName(raw.account_name);

  const status = String(raw.status || "pending").toLowerCase();
  const transferStatus = String(
    raw.transfer_status || raw.paystack_status || ""
  ).toLowerCase();
  const transferCode = raw.transfer_code || raw.reference || "";
  const rejectionReason =
    raw.rejection_reason || raw.reason || raw.admin_note || "";

  const createdAt =
    raw.created_at || raw.requested_at || raw.submitted_at || null;

  const needsOtp =
    transferStatus === "otp" ||
    Boolean(
      status === "approved" &&
        raw.transfer_code &&
        (transferStatus === "otp" || raw.requires_otp || raw.otp_required)
    );

  return {
    id,
    userName,
    userEmail,
    userRole,
    amount,
    bankName,
    fullBankName,
    bankCode,
    accountNumber,
    accountName,
    status,
    transferStatus,
    transferCode,
    rejectionReason,
    createdAt,
    needsOtp,
  };
}

function normalizeDisputeItem(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = raw.id ?? raw.dispute_id;
  const orderId = raw.order_id;
  const orderNumber =
    raw.order_number || (orderId ? `ORD-${orderId}` : `DSP-${id}`);
  const orderType = humanizeConstant(raw.order_type || "Order");
  const buyerName = toTitleCaseName(raw.buyer_name || "Buyer");
  const buyerEmail = raw.buyer_email || "";
  const reason = raw.reason || "other";
  const reasonDisplay =
    raw.reason_display || humanizeConstant(raw.reason || "Other");
  const details = raw.details || "";
  const evidenceUrls = Array.isArray(raw.evidence_urls)
    ? raw.evidence_urls
    : [];
  const status = String(raw.status || "open").toLowerCase();
  const statusDisplay =
    raw.status_display || humanizeConstant(raw.status || "open");
  const resolutionNotes = raw.resolution_notes || "";
  const createdAt = raw.created_at || null;
  const resolvedAt = raw.resolved_at || null;
  const orderAmountHeld = raw.order_amount_held ?? null;

  return {
    id,
    orderId,
    orderNumber,
    orderType,
    buyerName,
    buyerEmail,
    reason,
    reasonDisplay,
    details,
    evidenceUrls,
    status,
    statusDisplay,
    resolutionNotes,
    createdAt,
    resolvedAt,
    orderAmountHeld,
    raw,
  };
}

export default function FinancePage({ defaultTab }) {
  const location = useLocation();
  const navigate = useNavigate();

  // Active top-level module: 'withdrawals' | 'disputes'
  const [activeSection, setActiveSection] = useState(() => {
    if (defaultTab) return defaultTab;
    if (location.pathname.includes("dispute")) return "disputes";
    return "withdrawals";
  });

  useEffect(() => {
    if (location.pathname.includes("dispute")) {
      setActiveSection("disputes");
    } else if (defaultTab) {
      setActiveSection(defaultTab);
    }
  }, [location.pathname, defaultTab]);

  // Financial Stats state
  const [financialStats, setFinancialStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [datePreset, setDatePreset] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Withdrawal Summary state
  const [withdrawalSummary, setWithdrawalSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Withdrawal Requests List state
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [withdrawals, setWithdrawals] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [listLoading, setListLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Disputes Stats & List state
  const [disputeStats, setDisputeStats] = useState(null);
  const [disputeStatsLoading, setDisputeStatsLoading] = useState(true);
  const [disputes, setDisputes] = useState([]);
  const [disputeStatusFilter, setDisputeStatusFilter] = useState(""); // "" (all), open, investigating, resolved_refund, resolved_no_refund, closed
  const [disputeReasonFilter, setDisputeReasonFilter] = useState("");
  const [disputeResolutionFilter, setDisputeResolutionFilter] = useState("");
  const [disputePage, setDisputePage] = useState(1);
  const [disputeTotalCount, setDisputeTotalCount] = useState(0);
  const [disputeTotalPages, setDisputeTotalPages] = useState(1);
  const [disputesLoading, setDisputesLoading] = useState(true);
  const [disputeSearchQuery, setDisputeSearchQuery] = useState("");

  // Dispute Detail & Resolution Modal state
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [disputeDetailData, setDisputeDetailData] = useState(null);
  const [disputeDetailLoading, setDisputeDetailLoading] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    resolution: "CREATOR_AT_FAULT",
    reason: "WRONG_ITEM",
    reason_other_detail: "",
    notes: "",
  });
  const [resolvePreview, setResolvePreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [resolvingSubmitting, setResolvingSubmitting] = useState(false);

  // Refresh & Alert state
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [banner, setBanner] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Withdrawal Modals & Action states
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'detail' | 'approve' | 'reject' | 'otp'
  const [rejectReason, setRejectReason] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [otpRequiredIds, setOtpRequiredIds] = useState(() => new Set());

  const showBanner = useCallback((text, type = "success") => {
    setBanner({ text, type });
  }, []);

  useEffect(() => {
    if (!banner) return undefined;
    const timer = setTimeout(() => {
      setBanner(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [banner]);

  // 1. GET /api/wallet/admin/financial-stats/
  const fetchFinancialStats = useCallback(
    async (customFrom = dateFrom, customTo = dateTo, isSilent = false) => {
      if (!isSilent) setStatsLoading(true);
      try {
        const API = getAxiosInstance();
        const params = {};
        if (customFrom) params.date_from = customFrom;
        if (customTo) params.date_to = customTo;

        const res = await API.get("/wallet/admin/financial-stats/", { params });
        const payload = unwrapPayload(res);
        setFinancialStats(payload || {});
      } catch (err) {
        console.error("Failed to fetch financial stats:", err);
      } finally {
        setStatsLoading(false);
      }
    },
    [dateFrom, dateTo]
  );

  // 2. GET /api/admin/withdrawal-requests/summary/
  const fetchWithdrawalSummary = useCallback(async (isSilent = false) => {
    if (!isSilent) setSummaryLoading(true);
    try {
      const API = getAxiosInstance();
      const res = await API.get("/admin/withdrawal-requests/summary/");
      const payload = unwrapPayload(res);
      setWithdrawalSummary(payload || {});
    } catch (err) {
      console.error("Failed to fetch withdrawal summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // 3. GET /api/admin/withdrawal-requests/
  const fetchWithdrawalRequests = useCallback(
    async (
      targetStatus = statusFilter,
      targetPage = page,
      isSilent = false
    ) => {
      if (!isSilent) setListLoading(true);
      try {
        const API = getAxiosInstance();
        const params = {
          status: targetStatus,
          page: targetPage,
          page_size: pageSize,
        };
        const res = await API.get("/admin/withdrawal-requests/", { params });
        const { items, count, totalPages: pages } = extractPaginatedList(res, [
          "withdrawals",
          "withdrawal_requests",
        ]);
        const normalized = items
          .map(normalizeWithdrawalItem)
          .filter(Boolean);
        setWithdrawals(normalized);
        setTotalCount(count);
        setTotalPages(pages);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to fetch withdrawal requests:", err);
      } finally {
        setListLoading(false);
      }
    },
    [statusFilter, page, pageSize]
  );

  // 4. GET /api/orders/disputes/stats/
  const fetchDisputeStats = useCallback(async (isSilent = false) => {
    if (!isSilent) setDisputeStatsLoading(true);
    try {
      const API = getAxiosInstance();
      const res = await API.get("/orders/disputes/stats/");
      const payload = unwrapPayload(res);
      setDisputeStats(payload || {});
    } catch (err) {
      console.error("Failed to fetch dispute stats:", err);
    } finally {
      setDisputeStatsLoading(false);
    }
  }, []);

  // 5. GET /api/orders/disputes/
  const fetchDisputesList = useCallback(
    async (
      targetStatus = disputeStatusFilter,
      targetReason = disputeReasonFilter,
      targetResolution = disputeResolutionFilter,
      targetPage = disputePage,
      isSilent = false
    ) => {
      if (!isSilent) setDisputesLoading(true);
      try {
        const API = getAxiosInstance();
        const params = {
          page: targetPage,
          page_size: pageSize,
        };
        if (targetStatus) params.status = targetStatus;
        if (targetReason) params.reason = targetReason;
        if (targetResolution) params.resolution = targetResolution;

        const res = await API.get("/orders/disputes/", { params });
        const { items, count, totalPages: pages } = extractPaginatedList(res, [
          "disputes",
        ]);
        const normalized = items.map(normalizeDisputeItem).filter(Boolean);
        setDisputes(normalized);
        setDisputeTotalCount(count);
        setDisputeTotalPages(pages);
        setLastUpdated(new Date());
      } catch (err) {
        console.error("Failed to fetch disputes:", err);
      } finally {
        setDisputesLoading(false);
      }
    },
    [
      disputeStatusFilter,
      disputeReasonFilter,
      disputeResolutionFilter,
      disputePage,
      pageSize,
    ]
  );

  // Initial load of summaries & stats
  useEffect(() => {
    fetchFinancialStats("", "", false);
    fetchWithdrawalSummary(false);
    fetchDisputeStats(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchWithdrawalRequests(statusFilter, page, false);
  }, [statusFilter, page, fetchWithdrawalRequests]);

  useEffect(() => {
    fetchDisputesList(
      disputeStatusFilter,
      disputeReasonFilter,
      disputeResolutionFilter,
      disputePage,
      false
    );
  }, [
    disputeStatusFilter,
    disputeReasonFilter,
    disputeResolutionFilter,
    disputePage,
    fetchDisputesList,
  ]);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchFinancialStats(dateFrom, dateTo, true),
      fetchWithdrawalSummary(true),
      fetchWithdrawalRequests(statusFilter, page, true),
      fetchDisputeStats(true),
      fetchDisputesList(
        disputeStatusFilter,
        disputeReasonFilter,
        disputeResolutionFilter,
        disputePage,
        true
      ),
    ]);
    setRefreshing(false);
  };

  // 6. GET /api/orders/disputes/{id}/
  const openDisputeModal = async (disputeItem) => {
    setSelectedDispute(disputeItem);
    setDisputeDetailData(null);
    setResolvePreview(null);
    const defaultReason = mapBuyerReasonToResolveReason(disputeItem.reason);
    setResolveForm({
      resolution: "CREATOR_AT_FAULT",
      reason: defaultReason,
      reason_other_detail: "",
      notes: "",
    });

    setDisputeDetailLoading(true);
    try {
      const API = getAxiosInstance();
      const res = await API.get(`/orders/disputes/${disputeItem.id}/`);
      const payload = unwrapPayload(res);
      setDisputeDetailData(payload || disputeItem.raw);
    } catch (err) {
      console.error("Failed to fetch dispute detail:", err);
      setDisputeDetailData(disputeItem.raw);
    } finally {
      setDisputeDetailLoading(false);
    }
  };

  const closeDisputeModal = () => {
    if (resolvingSubmitting) return;
    setSelectedDispute(null);
    setDisputeDetailData(null);
    setResolvePreview(null);
  };

  // 7. POST /api/orders/disputes/{id}/resolve/preview/
  const handlePreviewDisputeResolution = useCallback(
    async (disputeId, resolutionVal, reasonVal) => {
      if (!disputeId || !resolutionVal || !reasonVal) return;
      setPreviewLoading(true);
      try {
        const API = getAxiosInstance();
        const res = await API.post(
          `/orders/disputes/${disputeId}/resolve/preview/`,
          {
            resolution: resolutionVal,
            reason: reasonVal,
          }
        );
        const payload = unwrapPayload(res);
        setResolvePreview(payload || null);
      } catch (err) {
        console.error("Failed to preview dispute resolution:", err);
        setResolvePreview(null);
      } finally {
        setPreviewLoading(false);
      }
    },
    []
  );

  // Auto-run preview when viewing an unresolved dispute in the modal and resolution/reason changes
  const isDisputeOpenForResolution = Boolean(
    selectedDispute &&
      (selectedDispute.status === "open" ||
        selectedDispute.status === "investigating")
  );

  useEffect(() => {
    if (
      isDisputeOpenForResolution &&
      selectedDispute?.id &&
      resolveForm.resolution &&
      resolveForm.reason
    ) {
      handlePreviewDisputeResolution(
        selectedDispute.id,
        resolveForm.resolution,
        resolveForm.reason
      );
    }
  }, [
    isDisputeOpenForResolution,
    selectedDispute?.id,
    resolveForm.resolution,
    resolveForm.reason,
    handlePreviewDisputeResolution,
  ]);

  // 8. PATCH /api/orders/disputes/{id}/resolve/
  const handleResolveDisputeSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDispute?.id) return;
    if (!resolveForm.notes.trim()) {
      showBanner("Please provide resolution notes before submitting.", "warning");
      return;
    }

    setResolvingSubmitting(true);
    try {
      const API = getAxiosInstance();
      const body = {
        resolution: resolveForm.resolution,
        reason: resolveForm.reason,
        notes: resolveForm.notes.trim(),
      };
      if (
        resolveForm.reason === "OTHER" &&
        resolveForm.reason_other_detail.trim()
      ) {
        body.reason_other_detail = resolveForm.reason_other_detail.trim();
      }

      const res = await API.patch(
        `/orders/disputes/${selectedDispute.id}/resolve/`,
        body
      );

      await Promise.all([
        fetchDisputeStats(true),
        fetchDisputesList(
          disputeStatusFilter,
          disputeReasonFilter,
          disputeResolutionFilter,
          disputePage,
          true
        ),
        fetchFinancialStats(dateFrom, dateTo, true),
      ]);

      setSelectedDispute(null);
      setDisputeDetailData(null);
      setResolvePreview(null);
      showBanner(
        res?.data?.message ||
          `Dispute #${selectedDispute.id} (${selectedDispute.orderNumber}) resolved.`,
        "success"
      );
    } catch (err) {
      console.error("Failed to resolve dispute:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Could not resolve dispute. Please verify input and try again.";
      showBanner(errMsg, "error");
    } finally {
      setResolvingSubmitting(false);
    }
  };

  // Date preset handler
  const handleSelectDatePreset = (preset) => {
    setDatePreset(preset);
    const today = new Date();
    const toIso = (d) => d.toISOString().split("T")[0];

    if (preset === "all") {
      setDateFrom("");
      setDateTo("");
      fetchFinancialStats("", "", false);
      return;
    }
    if (preset === "today") {
      const iso = toIso(today);
      setDateFrom(iso);
      setDateTo(iso);
      fetchFinancialStats(iso, iso, false);
      return;
    }
    if (preset === "7d") {
      const start = new Date(today);
      start.setDate(today.getDate() - 7);
      const fromIso = toIso(start);
      const toIsoStr = toIso(today);
      setDateFrom(fromIso);
      setDateTo(toIsoStr);
      fetchFinancialStats(fromIso, toIsoStr, false);
      return;
    }
    if (preset === "30d") {
      const start = new Date(today);
      start.setDate(today.getDate() - 30);
      const fromIso = toIso(start);
      const toIsoStr = toIso(today);
      setDateFrom(fromIso);
      setDateTo(toIsoStr);
      fetchFinancialStats(fromIso, toIsoStr, false);
      return;
    }
    if (preset === "custom") {
      setDatePreset("custom");
    }
  };

  const handleApplyCustomDates = (e) => {
    e.preventDefault();
    fetchFinancialStats(dateFrom, dateTo, false);
  };

  const handleCopyAccount = (e, text, id) => {
    if (e) e.stopPropagation();
    if (!text || text === "—") return;
    navigator.clipboard?.writeText(String(text));
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((prev) => (prev === id ? null : prev));
    }, 1800);
  };

  const openModal = (reqItem, mode, e) => {
    if (e) e.stopPropagation();
    setSelectedRequest(reqItem);
    setModalMode(mode);
    setRejectReason("");
    setOtpCode("");
  };

  const closeModal = () => {
    if (actionLoadingId) return;
    setSelectedRequest(null);
    setModalMode(null);
    setRejectReason("");
    setOtpCode("");
  };

  // POST /api/admin/withdrawal-requests/{id}/approve/
  const handleApproveWithdrawal = async (reqItem) => {
    if (!reqItem?.id) return;
    setActionLoadingId(reqItem.id);
    try {
      const API = getAxiosInstance();
      const res = await API.post(
        `/admin/withdrawal-requests/${reqItem.id}/approve/`
      );
      const payload = unwrapPayload(res) || {};
      const transferStatus = String(
        payload.transfer_status ||
          res?.data?.transfer_status ||
          payload.status ||
          ""
      ).toLowerCase();

      await Promise.all([
        fetchWithdrawalSummary(true),
        fetchWithdrawalRequests(statusFilter, page, true),
        fetchFinancialStats(dateFrom, dateTo, true),
      ]);

      if (transferStatus === "otp" || payload.requires_otp) {
        setOtpRequiredIds((prev) => {
          const next = new Set(prev);
          next.add(reqItem.id);
          return next;
        });
        setSelectedRequest({
          ...reqItem,
          status: "approved",
          needsOtp: true,
          transferCode: payload.transfer_code || reqItem.transferCode || "",
        });
        setModalMode("otp");
        showBanner(
          "Withdrawal approved. Enter the Paystack OTP to finalize transfer.",
          "warning"
        );
      } else {
        setSelectedRequest(null);
        setModalMode(null);
        showBanner(
          res?.data?.message ||
            `Withdrawal of ${formatNaira(reqItem.amount)} for ${reqItem.userName} approved.`,
          "success"
        );
      }
    } catch (err) {
      console.error("Approve withdrawal failed:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to approve withdrawal request.";
      showBanner(errMsg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // POST /api/admin/withdrawal-requests/{id}/finalize/
  const handleFinalizeOtp = async (e) => {
    e.preventDefault();
    if (!selectedRequest?.id) return;
    const cleanOtp = otpCode.trim();
    if (!cleanOtp) {
      showBanner("Please enter the OTP sent by Paystack.", "warning");
      return;
    }

    setActionLoadingId(selectedRequest.id);
    try {
      const API = getAxiosInstance();
      const res = await API.post(
        `/admin/withdrawal-requests/${selectedRequest.id}/finalize/`,
        { otp: cleanOtp }
      );

      setOtpRequiredIds((prev) => {
        const next = new Set(prev);
        next.delete(selectedRequest.id);
        return next;
      });

      await Promise.all([
        fetchWithdrawalSummary(true),
        fetchWithdrawalRequests(statusFilter, page, true),
        fetchFinancialStats(dateFrom, dateTo, true),
      ]);

      setSelectedRequest(null);
      setModalMode(null);
      setOtpCode("");
      showBanner(
        res?.data?.message || "OTP accepted and bank transfer finalized.",
        "success"
      );
    } catch (err) {
      console.error("Finalize OTP failed:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "OTP rejected or transfer could not be finalized.";
      showBanner(errMsg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // POST /api/admin/withdrawal-requests/{id}/reject/
  const handleRejectWithdrawal = async (e) => {
    e.preventDefault();
    if (!selectedRequest?.id) return;

    setActionLoadingId(selectedRequest.id);
    try {
      const API = getAxiosInstance();
      const payload = {};
      if (rejectReason.trim()) {
        payload.reason = rejectReason.trim();
      }
      const res = await API.post(
        `/admin/withdrawal-requests/${selectedRequest.id}/reject/`,
        payload
      );

      await Promise.all([
        fetchWithdrawalSummary(true),
        fetchWithdrawalRequests(statusFilter, page, true),
      ]);

      setSelectedRequest(null);
      setModalMode(null);
      setRejectReason("");
      showBanner(
        res?.data?.message ||
          `Withdrawal request for ${selectedRequest.userName} rejected.`,
        "success"
      );
    } catch (err) {
      console.error("Reject withdrawal failed:", err);
      const errMsg =
        err?.response?.data?.message ||
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        "Failed to reject withdrawal request.";
      showBanner(errMsg, "error");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Withdrawal Summary metrics
  const totalWithdrawn = Number(
    withdrawalSummary?.total_withdrawn ??
      withdrawalSummary?.approved_total ??
      withdrawalSummary?.total_approved ??
      0
  );
  const totalPendingAmount = Number(
    withdrawalSummary?.total_pending_amount ??
      withdrawalSummary?.pending_amount ??
      0
  );
  const totalPendingCount = Number(
    withdrawalSummary?.total_pending_count ??
      withdrawalSummary?.pending_count ??
      0
  );

  // Dispute Summary metrics (from GET /api/orders/disputes/stats/)
  const totalDisputesCount = Number(
    disputeStats?.total ??
      disputeStats?.total_disputes ??
      disputeStats?.count ??
      disputeTotalCount ??
      0
  );
  const openDisputesCount = Number(
    disputeStats?.open ??
      disputeStats?.open_disputes ??
      disputeStats?.open_count ??
      disputeStats?.by_status?.open ??
      0
  );
  const resolvedDisputesCount = Number(
    disputeStats?.resolved ??
      disputeStats?.resolved_disputes ??
      disputeStats?.resolved_count ??
      0
  );
  const totalDisputeRefunded = Number(
    disputeStats?.total_refunded ??
      disputeStats?.refunded_amount ??
      disputeStats?.total_refunded_amount ??
      0
  );

  // Parsed 8 financial categories
  const parsedCategories = useMemo(() => {
    return FINANCIAL_CATEGORY_CONFIG.map((cfg) => ({
      ...cfg,
      ...parseFinancialMetric(financialStats, cfg),
    }));
  }, [financialStats]);

  // Client-side search within current page of withdrawals
  const filteredWithdrawals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return withdrawals;
    return withdrawals.filter((w) => {
      return (
        String(w.id || "")
          .toLowerCase()
          .includes(q) ||
        w.userName.toLowerCase().includes(q) ||
        w.userEmail.toLowerCase().includes(q) ||
        w.bankName.toLowerCase().includes(q) ||
        w.fullBankName.toLowerCase().includes(q) ||
        w.accountNumber.toLowerCase().includes(q) ||
        w.accountName.toLowerCase().includes(q)
      );
    });
  }, [withdrawals, searchQuery]);

  // Client-side search within current page of disputes
  const filteredDisputes = useMemo(() => {
    const q = disputeSearchQuery.trim().toLowerCase();
    if (!q) return disputes;
    return disputes.filter((d) => {
      return (
        String(d.id || "")
          .toLowerCase()
          .includes(q) ||
        d.orderNumber.toLowerCase().includes(q) ||
        d.buyerName.toLowerCase().includes(q) ||
        d.buyerEmail.toLowerCase().includes(q) ||
        d.reasonDisplay.toLowerCase().includes(q) ||
        d.details.toLowerCase().includes(q)
      );
    });
  }, [disputes, disputeSearchQuery]);

  const renderStatusBadge = (item) => {
    const isOtpPending = item.needsOtp || otpRequiredIds.has(item.id);
    if (isOtpPending) {
      return (
        <span className="fin-status-badge fin-status-otp">
          <span className="fin-status-dot" />
          OTP Required
        </span>
      );
    }
    if (item.status === "approved" || item.status === "completed") {
      return (
        <span className="fin-status-badge fin-status-approved">
          <span className="fin-status-dot" />
          Approved
        </span>
      );
    }
    if (item.status === "rejected" || item.status === "failed") {
      return (
        <span className="fin-status-badge fin-status-rejected">
          <span className="fin-status-dot" />
          Rejected
        </span>
      );
    }
    return (
      <span className="fin-status-badge fin-status-pending">
        <span className="fin-status-dot" />
        Pending
      </span>
    );
  };

  const renderDisputeStatusBadge = (statusStr, labelOverride) => {
    const s = String(statusStr || "open").toLowerCase();
    const label = labelOverride || humanizeConstant(s);
    if (s === "open") {
      return (
        <span className="fin-status-badge fin-status-pending">
          <span className="fin-status-dot" />
          {label}
        </span>
      );
    }
    if (s === "investigating") {
      return (
        <span className="fin-status-badge fin-status-otp">
          <span className="fin-status-dot" />
          {label}
        </span>
      );
    }
    if (s === "resolved_refund") {
      return (
        <span className="fin-status-badge fin-status-approved">
          <span className="fin-status-dot" />
          Resolved (Refund)
        </span>
      );
    }
    if (s === "resolved_no_refund" || s === "closed") {
      return (
        <span className="fin-status-badge fin-status-neutral">
          <span className="fin-status-dot" />
          {s === "resolved_no_refund" ? "No Refund" : "Closed"}
        </span>
      );
    }
    return (
      <span className="fin-status-badge fin-status-neutral">
        <span className="fin-status-dot" />
        {label}
      </span>
    );
  };

  // Extract preview actions array from POST /orders/disputes/{id}/resolve/preview/ response
  const previewActions = useMemo(() => {
    if (!resolvePreview || typeof resolvePreview !== "object") return [];
    if (Array.isArray(resolvePreview.actions)) return resolvePreview.actions;
    if (Array.isArray(resolvePreview.financial_actions))
      return resolvePreview.financial_actions;
    if (Array.isArray(resolvePreview.planned_actions))
      return resolvePreview.planned_actions;
    return [];
  }, [resolvePreview]);

  // Extract past resolutions array from GET /orders/disputes/{id}/ detail response
  const detailResolutions = useMemo(() => {
    if (!disputeDetailData || typeof disputeDetailData !== "object") return [];
    if (Array.isArray(disputeDetailData.resolutions)) {
      return disputeDetailData.resolutions;
    }
    return [];
  }, [disputeDetailData]);

  return (
    <div className="fin-page">
      {/* Header */}
      <header className="fin-header">
        <div className="fin-title-wrap">
          <h1 className="fin-title">
            {activeSection === "disputes"
              ? "Order Disputes & Escrow"
              : "Finance & Withdrawals"}
          </h1>
          <p className="fin-subtitle">
            {activeSection === "disputes"
              ? "Review buyer claims, preview financial fault splits, and execute atomic dispute resolutions"
              : "Platform wallet totals, payouts summary, and creator/rider withdrawal requests"}
          </p>
        </div>

        <div className="fin-header-actions">
          {lastUpdated && (
            <span className="fin-updated-text">
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            className="fin-btn fin-btn-secondary"
            onClick={handleRefreshAll}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={refreshing ? "fin-spin" : ""} />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* Top View Switcher: Finance & Withdrawals vs Order Disputes */}
      <div className="fin-view-switcher" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "withdrawals"}
          className={`fin-view-btn${
            activeSection === "withdrawals" ? " active" : ""
          }`}
          onClick={() => {
            setActiveSection("withdrawals");
            if (location.pathname === "/disputes") {
              navigate("/finance");
            }
          }}
        >
          <span>Finance &amp; Withdrawals</span>
          {!summaryLoading && totalPendingCount > 0 && (
            <span className="fin-view-count alert">{totalPendingCount}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSection === "disputes"}
          className={`fin-view-btn${
            activeSection === "disputes" ? " active" : ""
          }`}
          onClick={() => {
            setActiveSection("disputes");
          }}
        >
          <span>Order Disputes</span>
          {!disputeStatsLoading && openDisputesCount > 0 && (
            <span className="fin-view-count alert">{openDisputesCount}</span>
          )}
        </button>
      </div>

      {/* Alert Banner */}
      {banner && (
        <div className={`fin-alert fin-alert-${banner.type}`} role="alert">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {banner.type === "success" ? (
              <CheckCircle2 size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            <span>{banner.text}</span>
          </div>
          <button
            type="button"
            className="fin-alert-close"
            onClick={() => setBanner(null)}
            aria-label="Dismiss"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ============================================================
          VIEW 1: FINANCE & WITHDRAWALS
          ============================================================ */}
      {activeSection === "withdrawals" && (
        <>
          {/* Unified 3-Column Payout Summary Ribbon (GET /api/admin/withdrawal-requests/summary/) */}
          <section
            className="fin-overview-ribbon"
            aria-label="Withdrawal Requests Summary"
          >
            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">
                  Pending Payout Amount
                </span>
                <span
                  className={`fin-status-badge ${
                    totalPendingCount > 0
                      ? "fin-status-pending"
                      : "fin-status-approved"
                  }`}
                >
                  <span className="fin-status-dot" />
                  {summaryLoading
                    ? "—"
                    : totalPendingCount > 0
                    ? `${totalPendingCount} Pending`
                    : "Queue Clear"}
                </span>
              </div>
              {summaryLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "55%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {formatNaira(totalPendingAmount)}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>Awaiting approval</span>
                {statusFilter !== "pending" && totalPendingCount > 0 && (
                  <button
                    type="button"
                    className="fin-btn fin-btn-secondary fin-btn-sm"
                    onClick={() => {
                      setStatusFilter("pending");
                      setPage(1);
                    }}
                  >
                    Review
                  </button>
                )}
              </div>
            </div>

            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">
                  Total Approved Payouts
                </span>
                <span className="fin-status-badge fin-status-approved">
                  <span className="fin-status-dot" />
                  Disbursed
                </span>
              </div>
              {summaryLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "55%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {formatNaira(totalWithdrawn)}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>Completed bank transfers</span>
              </div>
            </div>

            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">Pending Requests</span>
              </div>
              {summaryLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "30%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {totalPendingCount.toLocaleString()}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>
                  {totalPendingCount === 0
                    ? "No pending requests"
                    : `${totalPendingCount} request${
                        totalPendingCount === 1 ? "" : "s"
                      } to review`}
                </span>
              </div>
            </div>
          </section>

          {/* Platform Financial Ledger Matrix (GET /api/wallet/admin/financial-stats/) */}
          <section
            className="fin-ledger-card"
            aria-label="Platform Financial Totals"
          >
            <div className="fin-ledger-head">
              <h2 className="fin-ledger-title">Platform Financial Breakdown</h2>

              <div className="fin-filter-controls">
                <div className="fin-period-pills">
                  {[
                    { key: "all", label: "All Time" },
                    { key: "today", label: "Today" },
                    { key: "7d", label: "7D" },
                    { key: "30d", label: "30D" },
                    { key: "custom", label: "Custom" },
                  ].map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={`fin-period-btn${
                        datePreset === p.key ? " active" : ""
                      }`}
                      onClick={() => handleSelectDatePreset(p.key)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {datePreset === "custom" && (
                  <form
                    className="fin-custom-date-form"
                    onSubmit={handleApplyCustomDates}
                  >
                    <input
                      type="date"
                      className="fin-date-input"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      aria-label="Start date"
                    />
                    <span className="fin-date-sep">to</span>
                    <input
                      type="date"
                      className="fin-date-input"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      aria-label="End date"
                    />
                    <button
                      type="submit"
                      className="fin-btn fin-btn-primary fin-btn-sm"
                    >
                      Apply
                    </button>
                  </form>
                )}
              </div>
            </div>

            <div className="fin-ledger-matrix">
              {parsedCategories.map((cat) => {
                const isZero = Number(cat.amount) === 0;
                return (
                  <div key={cat.key} className="fin-ledger-cell">
                    <div className="fin-ledger-cell-top">
                      <span className="fin-ledger-label">{cat.title}</span>
                      {cat.count !== null &&
                        !statsLoading &&
                        cat.count > 0 && (
                          <span className="fin-ledger-count">
                            {cat.count.toLocaleString()}
                          </span>
                        )}
                    </div>

                    {statsLoading ? (
                      <div
                        className="fin-skeleton"
                        style={{ width: "60%", height: 24, marginTop: 2 }}
                      />
                    ) : (
                      <div
                        className={`fin-ledger-amount${
                          isZero ? " is-zero" : ""
                        }`}
                      >
                        {formatNaira(cat.amount)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Withdrawal Requests Table (GET /api/admin/withdrawal-requests/) */}
          <section
            className="fin-withdrawals-card"
            aria-label="Withdrawal Requests"
          >
            <div className="fin-withdrawals-bar">
              <div className="fin-bar-left">
                <h2 className="fin-ledger-title">Withdrawal Requests</h2>

                <div className="fin-tabs" role="tablist">
                  {[
                    {
                      key: "pending",
                      label: "Pending",
                      count: !summaryLoading ? totalPendingCount : null,
                    },
                    { key: "approved", label: "Approved", count: null },
                    { key: "rejected", label: "Rejected", count: null },
                  ].map((tab) => {
                    const isActive = statusFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`fin-tab-btn${isActive ? " active" : ""}`}
                        onClick={() => {
                          if (statusFilter !== tab.key) {
                            setStatusFilter(tab.key);
                            setPage(1);
                          }
                        }}
                      >
                        <span>{tab.label}</span>
                        {tab.count !== null && (
                          <span className="fin-tab-count">{tab.count}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="fin-search-wrap">
                <Search size={14} className="fin-search-icon" />
                <input
                  type="text"
                  className="fin-search-input"
                  placeholder="Search name, bank, or account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="fin-search-clear"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {listLoading ? (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Requester</th>
                      <th>Amount</th>
                      <th>Bank Account</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <tr key={n}>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 150, height: 15, marginBottom: 5 }}
                          />
                          <div
                            className="fin-skeleton"
                            style={{ width: 90, height: 11 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 95, height: 16 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 160, height: 14, marginBottom: 5 }}
                          />
                          <div
                            className="fin-skeleton"
                            style={{ width: 120, height: 11 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 100, height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 76, height: 22, borderRadius: 5 }}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="fin-skeleton"
                            style={{
                              width: 80,
                              height: 28,
                              marginLeft: "auto",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredWithdrawals.length === 0 ? (
              <div className="fin-empty">
                {searchQuery
                  ? `No withdrawal requests matching "${searchQuery}".`
                  : `No ${statusFilter} withdrawal requests found.`}
              </div>
            ) : (
              <>
                <div className="fin-table-wrap">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Requester</th>
                        <th>Amount</th>
                        <th>Bank Account</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWithdrawals.map((w) => {
                        const created = formatDateTime(w.createdAt);
                        const isBusy = actionLoadingId === w.id;
                        const needsOtp =
                          w.needsOtp || otpRequiredIds.has(w.id);

                        return (
                          <tr
                            key={w.id}
                            onClick={() => openModal(w, "detail")}
                          >
                            <td>
                              <div className="fin-requester">
                                <div className="fin-avatar">
                                  {getInitials(w.userName)}
                                </div>
                                <div className="fin-requester-info">
                                  <span className="fin-requester-name">
                                    {w.userName}
                                  </span>
                                  <span className="fin-requester-meta">
                                    {w.userRole}
                                    {w.userEmail ? ` · ${w.userEmail}` : ""}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="fin-amount-col">
                              {formatNaira(w.amount)}
                            </td>

                            <td>
                              <div className="fin-bank-col">
                                <span className="fin-acct-holder">
                                  {w.accountName}
                                </span>
                                <div className="fin-bank-sub">
                                  <span>{w.bankName}</span>
                                  <span>·</span>
                                  <span className="fin-mono-acct">
                                    {w.accountNumber}
                                  </span>
                                  {w.accountNumber &&
                                    w.accountNumber !== "—" && (
                                      <button
                                        type="button"
                                        className="fin-copy-btn"
                                        onClick={(e) =>
                                          handleCopyAccount(
                                            e,
                                            w.accountNumber,
                                            w.id
                                          )
                                        }
                                        title="Copy account number"
                                      >
                                        {copiedId === w.id ? (
                                          <Check size={12} color="#109e59" />
                                        ) : (
                                          <Copy size={12} />
                                        )}
                                      </button>
                                    )}
                                </div>
                              </div>
                            </td>

                            <td className="fin-date-col">
                              <span>{created.date}</span>
                              {created.time && (
                                <span className="fin-date-time">
                                  {created.time}
                                </span>
                              )}
                            </td>

                            <td>{renderStatusBadge(w)}</td>

                            <td>
                              <div
                                className="fin-actions-col"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {w.status === "pending" && (
                                  <>
                                    <button
                                      type="button"
                                      className="fin-btn fin-btn-approve fin-btn-sm"
                                      disabled={isBusy}
                                      onClick={(e) =>
                                        openModal(w, "approve", e)
                                      }
                                    >
                                      {isBusy ? "Processing..." : "Approve"}
                                    </button>
                                    <button
                                      type="button"
                                      className="fin-btn fin-btn-danger-outline fin-btn-sm"
                                      disabled={isBusy}
                                      onClick={(e) => openModal(w, "reject", e)}
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}

                                {(needsOtp ||
                                  (w.status === "approved" &&
                                    w.transferCode)) && (
                                  <button
                                    type="button"
                                    className="fin-btn fin-btn-warning fin-btn-sm"
                                    disabled={isBusy}
                                    onClick={(e) => openModal(w, "otp", e)}
                                  >
                                    Finalize OTP
                                  </button>
                                )}

                                <button
                                  type="button"
                                  className="fin-btn fin-btn-secondary fin-btn-sm"
                                  onClick={(e) => openModal(w, "detail", e)}
                                >
                                  View
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List (<= 860px) */}
                <div className="fin-mobile-list">
                  {filteredWithdrawals.map((w) => {
                    const created = formatDateTime(w.createdAt);
                    const isBusy = actionLoadingId === w.id;
                    const needsOtp = w.needsOtp || otpRequiredIds.has(w.id);

                    return (
                      <div
                        key={w.id}
                        className="fin-mcard"
                        onClick={() => openModal(w, "detail")}
                      >
                        <div className="fin-mcard-head">
                          <div className="fin-mcard-user">
                            <div className="fin-avatar">
                              {getInitials(w.userName)}
                            </div>
                            <div className="fin-requester-info">
                              <span className="fin-requester-name">
                                {w.userName}
                              </span>
                              <span className="fin-requester-meta">
                                {w.userRole}
                              </span>
                            </div>
                          </div>
                          {renderStatusBadge(w)}
                        </div>

                        <div className="fin-mcard-amount-row">
                          <span className="fin-mcard-amount">
                            {formatNaira(w.amount)}
                          </span>
                          <span className="fin-mcard-date">
                            {created.date}
                            {created.time ? ` · ${created.time}` : ""}
                          </span>
                        </div>

                        <div className="fin-mcard-bank">
                          <span className="fin-acct-holder">
                            {w.accountName}
                          </span>
                          <div className="fin-bank-sub">
                            <span>{w.bankName}</span>
                            <span>·</span>
                            <span className="fin-mono-acct">
                              {w.accountNumber}
                            </span>
                            {w.accountNumber && w.accountNumber !== "—" && (
                              <button
                                type="button"
                                className="fin-copy-btn"
                                onClick={(e) =>
                                  handleCopyAccount(e, w.accountNumber, w.id)
                                }
                                aria-label="Copy account number"
                              >
                                {copiedId === w.id ? (
                                  <Check size={12} color="#109e59" />
                                ) : (
                                  <Copy size={12} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        <div
                          className="fin-mcard-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {w.status === "pending" && (
                            <>
                              <button
                                type="button"
                                className="fin-btn fin-btn-approve fin-btn-sm"
                                disabled={isBusy}
                                onClick={(e) => openModal(w, "approve", e)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="fin-btn fin-btn-danger-outline fin-btn-sm"
                                disabled={isBusy}
                                onClick={(e) => openModal(w, "reject", e)}
                              >
                                Reject
                              </button>
                            </>
                          )}

                          {(needsOtp ||
                            (w.status === "approved" && w.transferCode)) && (
                            <button
                              type="button"
                              className="fin-btn fin-btn-warning fin-btn-sm"
                              disabled={isBusy}
                              onClick={(e) => openModal(w, "otp", e)}
                            >
                              Finalize OTP
                            </button>
                          )}

                          <button
                            type="button"
                            className="fin-btn fin-btn-secondary fin-btn-sm"
                            onClick={(e) => openModal(w, "detail", e)}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="fin-pagination">
              <span className="fin-page-info">
                Page <strong>{page}</strong> of{" "}
                <strong>{Math.max(1, totalPages)}</strong>
                {totalCount > 0 ? ` · ${totalCount.toLocaleString()} total` : ""}
              </span>

              <div className="fin-page-controls">
                <button
                  type="button"
                  className="fin-btn fin-btn-secondary fin-btn-sm"
                  disabled={page <= 1 || listLoading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="fin-btn fin-btn-secondary fin-btn-sm"
                  disabled={page >= totalPages || listLoading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ============================================================
          VIEW 2: ORDER DISPUTES & RESOLUTION WORKBENCH
          ============================================================ */}
      {activeSection === "disputes" && (
        <>
          {/* 4-Column Dispute Overview Ribbon (GET /api/orders/disputes/stats/) */}
          <section
            className="fin-overview-ribbon cols-4"
            aria-label="Order Disputes Statistics"
          >
            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">Open Disputes</span>
                <span
                  className={`fin-status-badge ${
                    openDisputesCount > 0
                      ? "fin-status-pending"
                      : "fin-status-approved"
                  }`}
                >
                  <span className="fin-status-dot" />
                  {disputeStatsLoading
                    ? "—"
                    : openDisputesCount > 0
                    ? "Action Needed"
                    : "All Clear"}
                </span>
              </div>
              {disputeStatsLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "40%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {openDisputesCount.toLocaleString()}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>Awaiting fault determination</span>
              </div>
            </div>

            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">Resolved Disputes</span>
                <span className="fin-status-badge fin-status-approved">
                  <span className="fin-status-dot" />
                  Completed
                </span>
              </div>
              {disputeStatsLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "40%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {resolvedDisputesCount.toLocaleString()}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>Settled buyer &amp; escrow claims</span>
              </div>
            </div>

            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">
                  Refunded via Disputes
                </span>
              </div>
              {disputeStatsLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "55%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {formatNaira(totalDisputeRefunded)}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>Credited back to buyers</span>
              </div>
            </div>

            <div className="fin-overview-metric">
              <div className="fin-overview-top">
                <span className="fin-overview-label">Total Disputes</span>
              </div>
              {disputeStatsLoading ? (
                <div
                  className="fin-skeleton"
                  style={{ width: "40%", height: 28 }}
                />
              ) : (
                <div className="fin-overview-val">
                  {totalDisputesCount.toLocaleString()}
                </div>
              )}
              <div className="fin-overview-foot">
                <span>All-time recorded disputes</span>
              </div>
            </div>
          </section>

          {/* Disputes Management Card (GET /api/orders/disputes/) */}
          <section className="fin-withdrawals-card" aria-label="Order Disputes">
            <div className="fin-withdrawals-bar">
              <div className="fin-bar-left">
                <div className="fin-tabs" role="tablist">
                  {[
                    { key: "", label: "All" },
                    { key: "open", label: "Open" },
                    { key: "investigating", label: "Investigating" },
                    { key: "resolved_refund", label: "Refunded" },
                    { key: "resolved_no_refund", label: "No Refund" },
                    { key: "closed", label: "Closed" },
                  ].map((tab) => {
                    const isActive = disputeStatusFilter === tab.key;
                    return (
                      <button
                        key={tab.key || "all"}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        className={`fin-tab-btn${isActive ? " active" : ""}`}
                        onClick={() => {
                          if (disputeStatusFilter !== tab.key) {
                            setDisputeStatusFilter(tab.key);
                            setDisputePage(1);
                          }
                        }}
                      >
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="fin-bar-right">
                <select
                  className="fin-select"
                  value={disputeReasonFilter}
                  onChange={(e) => {
                    setDisputeReasonFilter(e.target.value);
                    setDisputePage(1);
                  }}
                  aria-label="Filter by reason"
                >
                  {DISPUTE_FILTER_REASON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <select
                  className="fin-select"
                  value={disputeResolutionFilter}
                  onChange={(e) => {
                    setDisputeResolutionFilter(e.target.value);
                    setDisputePage(1);
                  }}
                  aria-label="Filter by resolution"
                >
                  {DISPUTE_FILTER_RESOLUTION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                <div className="fin-search-wrap">
                  <Search size={14} className="fin-search-icon" />
                  <input
                    type="text"
                    className="fin-search-input"
                    placeholder="Search order #, buyer, reason..."
                    value={disputeSearchQuery}
                    onChange={(e) => setDisputeSearchQuery(e.target.value)}
                  />
                  {disputeSearchQuery && (
                    <button
                      type="button"
                      className="fin-search-clear"
                      onClick={() => setDisputeSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {disputesLoading ? (
              <div className="fin-table-wrap">
                <table className="fin-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Buyer</th>
                      <th>Reason &amp; Claim</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <tr key={n}>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 110, height: 15, marginBottom: 5 }}
                          />
                          <div
                            className="fin-skeleton"
                            style={{ width: 70, height: 11 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 140, height: 15, marginBottom: 5 }}
                          />
                          <div
                            className="fin-skeleton"
                            style={{ width: 110, height: 11 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 150, height: 14, marginBottom: 5 }}
                          />
                          <div
                            className="fin-skeleton"
                            style={{ width: 190, height: 11 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 95, height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="fin-skeleton"
                            style={{ width: 80, height: 22, borderRadius: 5 }}
                          />
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div
                            className="fin-skeleton"
                            style={{
                              width: 80,
                              height: 28,
                              marginLeft: "auto",
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : filteredDisputes.length === 0 ? (
              <div className="fin-empty">
                {disputeSearchQuery
                  ? `No disputes matching "${disputeSearchQuery}".`
                  : "No order disputes found for the selected filters."}
              </div>
            ) : (
              <>
                <div className="fin-table-wrap">
                  <table className="fin-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Buyer</th>
                        <th>Reason &amp; Claim</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDisputes.map((d) => {
                        const created = formatDateTime(d.createdAt);
                        const isOpen =
                          d.status === "open" || d.status === "investigating";

                        return (
                          <tr
                            key={d.id}
                            onClick={() => openDisputeModal(d)}
                          >
                            <td>
                              <div className="fin-order-col">
                                <span className="fin-order-num">
                                  {d.orderNumber}
                                </span>
                                <span className="fin-order-type">
                                  {d.orderType} · #{d.id}
                                </span>
                              </div>
                            </td>

                            <td>
                              <div className="fin-requester">
                                <div className="fin-avatar">
                                  {getInitials(d.buyerName)}
                                </div>
                                <div className="fin-requester-info">
                                  <span className="fin-requester-name">
                                    {d.buyerName}
                                  </span>
                                  <span className="fin-requester-meta">
                                    {d.buyerEmail || `Buyer #${d.raw?.buyer_id || ""}`}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td>
                              <div className="fin-dispute-reason-col">
                                <span className="fin-dispute-reason-title">
                                  {d.reasonDisplay}
                                </span>
                                {d.details && (
                                  <span className="fin-dispute-snippet">
                                    {d.details}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="fin-date-col">
                              <span>{created.date}</span>
                              {created.time && (
                                <span className="fin-date-time">
                                  {created.time}
                                </span>
                              )}
                            </td>

                            <td>
                              {renderDisputeStatusBadge(
                                d.status,
                                d.statusDisplay
                              )}
                            </td>

                            <td>
                              <div
                                className="fin-actions-col"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={`fin-btn fin-btn-sm ${
                                    isOpen
                                      ? "fin-btn-primary"
                                      : "fin-btn-secondary"
                                  }`}
                                  onClick={() => openDisputeModal(d)}
                                >
                                  {isOpen ? "Review & Resolve" : "View"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Dispute Cards (<= 860px) */}
                <div className="fin-mobile-list">
                  {filteredDisputes.map((d) => {
                    const created = formatDateTime(d.createdAt);
                    const isOpen =
                      d.status === "open" || d.status === "investigating";

                    return (
                      <div
                        key={d.id}
                        className="fin-mcard"
                        onClick={() => openDisputeModal(d)}
                      >
                        <div className="fin-mcard-head">
                          <div>
                            <span className="fin-order-num">
                              {d.orderNumber}
                            </span>
                            <div className="fin-requester-meta">
                              {d.buyerName} · {created.date}
                            </div>
                          </div>
                          {renderDisputeStatusBadge(d.status, d.statusDisplay)}
                        </div>

                        <div className="fin-mcard-bank">
                          <span className="fin-acct-holder">
                            {d.reasonDisplay}
                          </span>
                          {d.details && (
                            <span className="fin-requester-meta">
                              {d.details}
                            </span>
                          )}
                        </div>

                        <div
                          className="fin-mcard-actions"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className={`fin-btn fin-btn-sm ${
                              isOpen ? "fin-btn-primary" : "fin-btn-secondary"
                            }`}
                            onClick={() => openDisputeModal(d)}
                          >
                            {isOpen ? "Review & Resolve" : "View Details"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="fin-pagination">
              <span className="fin-page-info">
                Page <strong>{disputePage}</strong> of{" "}
                <strong>{Math.max(1, disputeTotalPages)}</strong>
                {disputeTotalCount > 0
                  ? ` · ${disputeTotalCount.toLocaleString()} total`
                  : ""}
              </span>

              <div className="fin-page-controls">
                <button
                  type="button"
                  className="fin-btn fin-btn-secondary fin-btn-sm"
                  disabled={disputePage <= 1 || disputesLoading}
                  onClick={() => setDisputePage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  className="fin-btn fin-btn-secondary fin-btn-sm"
                  disabled={
                    disputePage >= disputeTotalPages || disputesLoading
                  }
                  onClick={() => setDisputePage((p) => p + 1)}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ============================================================
          MODAL 1: WITHDRAWAL REQUEST RECEIPT & ACTIONS
          ============================================================ */}
      {selectedRequest && modalMode && (
        <div
          className="fin-modal-backdrop"
          onClick={closeModal}
          role="presentation"
        >
          <div
            className="fin-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="fin-modal-head">
              <div className="fin-modal-head-left">
                <h3 className="fin-modal-title">
                  {modalMode === "approve" && "Approve Withdrawal"}
                  {modalMode === "reject" && "Reject Withdrawal"}
                  {modalMode === "otp" && "Finalize Transfer OTP"}
                  {modalMode === "detail" && "Withdrawal Details"}
                </h3>
                {selectedRequest.id && (
                  <span className="fin-modal-id-tag">
                    #{selectedRequest.id}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="fin-modal-close"
                onClick={closeModal}
                aria-label="Close modal"
              >
                <X size={15} />
              </button>
            </div>

            <div className="fin-modal-body">
              <div className="fin-modal-hero">
                <div>
                  <span className="fin-modal-hero-label">Payout Amount</span>
                  <div className="fin-modal-amount">
                    {formatNaira(selectedRequest.amount)}
                  </div>
                </div>
                {renderStatusBadge(selectedRequest)}
              </div>

              <div className="fin-modal-section">
                <span className="fin-modal-section-label">
                  Bank Account Details
                </span>
                <div className="fin-kv-list">
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Account Holder</span>
                    <span className="fin-kv-val">
                      {selectedRequest.accountName}
                    </span>
                  </div>
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Account Number</span>
                    <span className="fin-kv-val">
                      <span className="fin-mono-acct">
                        {selectedRequest.accountNumber}
                      </span>
                      {selectedRequest.accountNumber &&
                        selectedRequest.accountNumber !== "—" && (
                          <button
                            type="button"
                            className="fin-copy-btn"
                            onClick={(e) =>
                              handleCopyAccount(
                                e,
                                selectedRequest.accountNumber,
                                `modal-${selectedRequest.id}`
                              )
                            }
                            title="Copy account number"
                          >
                            {copiedId === `modal-${selectedRequest.id}` ? (
                              <Check size={13} color="#109e59" />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        )}
                    </span>
                  </div>
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Bank</span>
                    <span className="fin-kv-val">
                      {selectedRequest.bankName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="fin-modal-section">
                <span className="fin-modal-section-label">
                  Request Information
                </span>
                <div className="fin-kv-list">
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Requester</span>
                    <span className="fin-kv-val">
                      <span>{selectedRequest.userName}</span>
                      {selectedRequest.userRole && (
                        <span className="fin-role-badge-inline">
                          {selectedRequest.userRole}
                        </span>
                      )}
                    </span>
                  </div>
                  {selectedRequest.userEmail && (
                    <div className="fin-kv-row">
                      <span className="fin-kv-label">Email</span>
                      <span className="fin-kv-val">
                        {selectedRequest.userEmail}
                      </span>
                    </div>
                  )}
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Submitted</span>
                    <span className="fin-kv-val">
                      {formatDateTime(selectedRequest.createdAt).date}
                      {formatDateTime(selectedRequest.createdAt).time
                        ? ` · ${formatDateTime(selectedRequest.createdAt).time}`
                        : ""}
                    </span>
                  </div>
                  {selectedRequest.transferCode && (
                    <div className="fin-kv-row">
                      <span className="fin-kv-label">Transfer Ref</span>
                      <span className="fin-kv-val fin-mono-acct">
                        {selectedRequest.transferCode}
                      </span>
                    </div>
                  )}
                  {selectedRequest.rejectionReason && (
                    <div className="fin-kv-row">
                      <span className="fin-kv-label">Rejection Note</span>
                      <span
                        className="fin-kv-val"
                        style={{ color: "#991b1b" }}
                      >
                        {selectedRequest.rejectionReason}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {modalMode === "approve" && (
                <p className="fin-confirm-notice">
                  Confirming will initiate a Paystack bank transfer of{" "}
                  <strong>{formatNaira(selectedRequest.amount)}</strong> to{" "}
                  <strong>{selectedRequest.accountName}</strong> and deduct the
                  amount from their wallet.
                </p>
              )}

              {modalMode === "reject" && (
                <form id="fin-reject-form" onSubmit={handleRejectWithdrawal}>
                  <div className="fin-form-group">
                    <label
                      htmlFor="fin-reject-reason"
                      className="fin-form-label"
                    >
                      Rejection Reason (optional)
                    </label>
                    <textarea
                      id="fin-reject-reason"
                      rows={3}
                      className="fin-form-textarea"
                      placeholder="Add a note for the creator or rider..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>

                  <div className="fin-form-group" style={{ marginTop: 10 }}>
                    <div className="fin-reason-chips">
                      {REJECTION_REASON_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          className="fin-reason-chip"
                          onClick={() => setRejectReason(preset)}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </form>
              )}

              {modalMode === "otp" && (
                <form id="fin-otp-form" onSubmit={handleFinalizeOtp}>
                  <div className="fin-form-group">
                    <label htmlFor="fin-otp-input" className="fin-form-label">
                      Paystack Transfer OTP
                    </label>
                    <input
                      id="fin-otp-input"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="fin-form-input fin-otp-input"
                      placeholder="123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                    />
                  </div>
                </form>
              )}
            </div>

            <div className="fin-modal-foot">
              <button
                type="button"
                className="fin-btn fin-btn-secondary"
                onClick={closeModal}
                disabled={Boolean(actionLoadingId)}
              >
                {modalMode === "detail" ? "Close" : "Cancel"}
              </button>

              {modalMode === "detail" &&
                selectedRequest.status === "pending" && (
                  <>
                    <button
                      type="button"
                      className="fin-btn fin-btn-danger-outline"
                      onClick={() => setModalMode("reject")}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="fin-btn fin-btn-approve"
                      onClick={() => setModalMode("approve")}
                    >
                      Approve
                    </button>
                  </>
                )}

              {modalMode === "detail" &&
                (selectedRequest.needsOtp ||
                  otpRequiredIds.has(selectedRequest.id) ||
                  (selectedRequest.status === "approved" &&
                    selectedRequest.transferCode)) && (
                  <button
                    type="button"
                    className="fin-btn fin-btn-warning"
                    onClick={() => setModalMode("otp")}
                  >
                    Finalize OTP
                  </button>
                )}

              {modalMode === "approve" && (
                <button
                  type="button"
                  className="fin-btn fin-btn-approve"
                  disabled={Boolean(actionLoadingId)}
                  onClick={() => handleApproveWithdrawal(selectedRequest)}
                >
                  {actionLoadingId === selectedRequest.id
                    ? "Approving..."
                    : "Confirm & Transfer"}
                </button>
              )}

              {modalMode === "reject" && (
                <button
                  type="submit"
                  form="fin-reject-form"
                  className="fin-btn fin-btn-danger"
                  disabled={Boolean(actionLoadingId)}
                >
                  {actionLoadingId === selectedRequest.id
                    ? "Rejecting..."
                    : "Reject Request"}
                </button>
              )}

              {modalMode === "otp" && (
                <button
                  type="submit"
                  form="fin-otp-form"
                  className="fin-btn fin-btn-primary"
                  disabled={Boolean(actionLoadingId) || !otpCode.trim()}
                >
                  {actionLoadingId === selectedRequest.id
                    ? "Verifying..."
                    : "Finalize Transfer"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL 2: DISPUTE DETAIL & ATOMIC RESOLUTION WORKBENCH
          ============================================================ */}
      {selectedDispute && (
        <div
          className="fin-modal-backdrop"
          onClick={closeDisputeModal}
          role="presentation"
        >
          <div
            className="fin-modal fin-modal-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="fin-modal-head">
              <div className="fin-modal-head-left">
                <h3 className="fin-modal-title">Order Dispute</h3>
                <span className="fin-modal-id-tag">
                  {selectedDispute.orderNumber}
                </span>
                <span className="fin-modal-id-tag">#{selectedDispute.id}</span>
              </div>
              <button
                type="button"
                className="fin-modal-close"
                onClick={closeDisputeModal}
                aria-label="Close modal"
              >
                <X size={15} />
              </button>
            </div>

            <div className="fin-modal-body">
              {/* Top Escrow / Order Amount & Status Hero */}
              <div className="fin-modal-hero">
                <div>
                  <span className="fin-modal-hero-label">
                    Escrow / Held Order Amount
                  </span>
                  <div className="fin-modal-amount">
                    {disputeDetailLoading
                      ? "Loading..."
                      : disputeDetailData?.order_amount_held !== undefined &&
                        disputeDetailData?.order_amount_held !== null
                      ? formatNaira(disputeDetailData.order_amount_held)
                      : selectedDispute.orderAmountHeld !== null
                      ? formatNaira(selectedDispute.orderAmountHeld)
                      : "—"}
                  </div>
                </div>
                {renderDisputeStatusBadge(
                  disputeDetailData?.status || selectedDispute.status,
                  disputeDetailData?.status_display ||
                    selectedDispute.statusDisplay
                )}
              </div>

              {/* Order & Buyer Context */}
              <div className="fin-modal-section">
                <span className="fin-modal-section-label">
                  Order &amp; Parties
                </span>
                <div className="fin-kv-list">
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Buyer</span>
                    <span className="fin-kv-val">
                      {selectedDispute.buyerName}
                      {selectedDispute.buyerEmail
                        ? ` (${selectedDispute.buyerEmail})`
                        : ""}
                    </span>
                  </div>
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Order Type</span>
                    <span className="fin-kv-val">
                      {selectedDispute.orderType}
                    </span>
                  </div>
                  {disputeDetailData?.order_status && (
                    <div className="fin-kv-row">
                      <span className="fin-kv-label">Order Status</span>
                      <span className="fin-kv-val">
                        {humanizeConstant(disputeDetailData.order_status)}
                      </span>
                    </div>
                  )}
                  <div className="fin-kv-row">
                    <span className="fin-kv-label">Submitted</span>
                    <span className="fin-kv-val">
                      {formatDateTime(selectedDispute.createdAt).date}
                      {formatDateTime(selectedDispute.createdAt).time
                        ? ` · ${formatDateTime(selectedDispute.createdAt).time}`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {/* Buyer Claim & Evidence */}
              <div className="fin-modal-section">
                <span className="fin-modal-section-label">
                  Buyer Claim — {selectedDispute.reasonDisplay}
                </span>
                <div className="fin-claim-box">
                  <div>
                    {selectedDispute.details ||
                      disputeDetailData?.details ||
                      "No additional description provided by the buyer."}
                  </div>

                  {selectedDispute.evidenceUrls.length > 0 && (
                    <div className="fin-evidence-grid">
                      {selectedDispute.evidenceUrls.map((url, idx) => (
                        <a
                          key={idx}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={url}
                            alt={`Evidence ${idx + 1}`}
                            className="fin-evidence-thumb"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* If already resolved, show resolution details */}
              {!isDisputeOpenForResolution && (
                <div className="fin-modal-section">
                  <span className="fin-modal-section-label">
                    Resolution Summary
                  </span>
                  <div className="fin-kv-list">
                    {selectedDispute.resolvedAt && (
                      <div className="fin-kv-row">
                        <span className="fin-kv-label">Resolved At</span>
                        <span className="fin-kv-val">
                          {formatDateTime(selectedDispute.resolvedAt).date}{" "}
                          {formatDateTime(selectedDispute.resolvedAt).time}
                        </span>
                      </div>
                    )}
                    {(disputeDetailData?.resolution_notes ||
                      selectedDispute.resolutionNotes) && (
                      <div className="fin-kv-row">
                        <span className="fin-kv-label">Notes</span>
                        <span className="fin-kv-val">
                          {disputeDetailData?.resolution_notes ||
                            selectedDispute.resolutionNotes}
                        </span>
                      </div>
                    )}
                  </div>

                  {detailResolutions.length > 0 &&
                    detailResolutions.map((resObj, idx) => (
                      <div
                        key={resObj.id || idx}
                        className="fin-preview-card"
                        style={{ marginTop: 8 }}
                      >
                        <div className="fin-preview-head">
                          <span>
                            {humanizeConstant(resObj.resolution_type)}
                          </span>
                          <span>{humanizeConstant(resObj.status)}</span>
                        </div>
                        {Array.isArray(resObj.actions) &&
                          resObj.actions.map((act, i) => (
                            <div key={act.id || i} className="fin-action-row">
                              <span className="fin-action-party">
                                <span>{humanizeConstant(act.party)}</span>
                                <span className="fin-role-badge-inline">
                                  {act.direction}
                                </span>
                              </span>
                              <span
                                className={`fin-action-amount ${
                                  act.direction === "CREDIT"
                                    ? "credit"
                                    : "debit"
                                }`}
                              >
                                {act.direction === "CREDIT" ? "+" : "-"}
                                {formatNaira(act.amount)}
                              </span>
                            </div>
                          ))}
                      </div>
                    ))}
                </div>
              )}

              {/* If Open / Investigating: Show Resolution Decision Form + Read-Only Financial Consequence Preview */}
              {isDisputeOpenForResolution && (
                <form
                  id="fin-dispute-resolve-form"
                  onSubmit={handleResolveDisputeSubmit}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <div className="fin-form-grid-2">
                    <div className="fin-form-group">
                      <label
                        htmlFor="fin-res-decision"
                        className="fin-form-label"
                      >
                        Fault Determination
                      </label>
                      <select
                        id="fin-res-decision"
                        className="fin-form-select"
                        value={resolveForm.resolution}
                        onChange={(e) =>
                          setResolveForm((prev) => ({
                            ...prev,
                            resolution: e.target.value,
                          }))
                        }
                      >
                        {DISPUTE_RESOLUTION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="fin-form-group">
                      <label
                        htmlFor="fin-res-reason"
                        className="fin-form-label"
                      >
                        Verified Reason
                      </label>
                      <select
                        id="fin-res-reason"
                        className="fin-form-select"
                        value={resolveForm.reason}
                        onChange={(e) =>
                          setResolveForm((prev) => ({
                            ...prev,
                            reason: e.target.value,
                          }))
                        }
                      >
                        {DISPUTE_RESOLVE_REASON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {resolveForm.reason === "OTHER" && (
                    <div className="fin-form-group">
                      <label
                        htmlFor="fin-res-other"
                        className="fin-form-label"
                      >
                        Specify Other Reason
                      </label>
                      <input
                        id="fin-res-other"
                        type="text"
                        className="fin-form-input"
                        placeholder="Short description of the issue..."
                        value={resolveForm.reason_other_detail}
                        onChange={(e) =>
                          setResolveForm((prev) => ({
                            ...prev,
                            reason_other_detail: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  {/* Read-only Financial Consequence Preview (POST /orders/disputes/{id}/resolve/preview/) */}
                  <div className="fin-preview-card">
                    <div className="fin-preview-head">
                      <span>Calculated Financial Impact Preview</span>
                      {previewLoading && <span>Calculating...</span>}
                    </div>

                    {previewLoading ? (
                      <div
                        className="fin-skeleton"
                        style={{ width: "100%", height: 34 }}
                      />
                    ) : previewActions.length > 0 ? (
                      previewActions.map((act, idx) => (
                        <div key={idx} className="fin-action-row">
                          <span className="fin-action-party">
                            <span>{humanizeConstant(act.party)}</span>
                            <span className="fin-role-badge-inline">
                              {act.direction}
                            </span>
                          </span>
                          <span
                            className={`fin-action-amount ${
                              act.direction === "CREDIT" ? "credit" : "debit"
                            }`}
                          >
                            {act.direction === "CREDIT" ? "+" : "-"}
                            {formatNaira(act.amount)}
                          </span>
                        </div>
                      ))
                    ) : resolvePreview ? (
                      <div className="fin-kv-list">
                        {Object.entries(resolvePreview)
                          .filter(
                            ([k, v]) =>
                              typeof v === "string" || typeof v === "number"
                          )
                          .map(([k, v]) => (
                            <div key={k} className="fin-kv-row">
                              <span className="fin-kv-label">
                                {humanizeConstant(k)}
                              </span>
                              <span className="fin-kv-val">
                                {typeof v === "number" ||
                                (typeof v === "string" &&
                                  /^\d+(\.\d+)?$/.test(v))
                                  ? formatNaira(v)
                                  : String(v)}
                              </span>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span
                        style={{ fontSize: "0.78rem", color: "#64748b" }}
                      >
                        Backend will calculate and execute the exact escrow split
                        atomically upon confirmation.
                      </span>
                    )}
                  </div>

                  <div className="fin-form-group">
                    <label htmlFor="fin-res-notes" className="fin-form-label">
                      Admin Resolution Notes (required)
                    </label>
                    <textarea
                      id="fin-res-notes"
                      rows={3}
                      className="fin-form-textarea"
                      placeholder="Document why this fault decision was made..."
                      value={resolveForm.notes}
                      onChange={(e) =>
                        setResolveForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                </form>
              )}
            </div>

            <div className="fin-modal-foot">
              <button
                type="button"
                className="fin-btn fin-btn-secondary"
                onClick={closeDisputeModal}
                disabled={resolvingSubmitting}
              >
                {isDisputeOpenForResolution ? "Cancel" : "Close"}
              </button>

              {isDisputeOpenForResolution && (
                <button
                  type="submit"
                  form="fin-dispute-resolve-form"
                  className="fin-btn fin-btn-primary"
                  disabled={
                    resolvingSubmitting || !resolveForm.notes.trim()
                  }
                >
                  {resolvingSubmitting
                    ? "Executing Resolution..."
                    : "Execute Resolution"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
