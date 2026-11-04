// src/pages/AdminDashboard.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAxiosInstance } from "../api";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";
import {
  Users,
  Activity,
  Calendar,
  CalendarDays,
  RefreshCw,
  Search,
  AlertCircle,
  ChefHat,
  ArrowUpRight,
} from "lucide-react";
import "./AdminDashboard.css";

Chart.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend
);

const ADMIN_STATS_CACHE_KEY = "cookeaze_admin_stats_cache_v1";

function getCachedAdminStats() {
  try {
    const raw = localStorage.getItem(ADMIN_STATS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

export default function AdminDashboard() {
  const initialCached = getCachedAdminStats();
  const [stats, setStats] = useState(() => initialCached?.data || null);
  const [loading, setLoading] = useState(() => !initialCached?.data);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() =>
    initialCached?.timestamp ? new Date(initialCached.timestamp) : null
  );
  const [recipeQuery, setRecipeQuery] = useState("");

  const fetchStats = useCallback(async (isManualRefresh = false) => {
    const hasCached = Boolean(getCachedAdminStats()?.data);
    if (isManualRefresh || hasCached) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const API = getAxiosInstance();
      const res = await API.get("/analytics/statistics/");
      const freshData = res.data?.data || null;
      if (freshData) {
        setStats(freshData);
        const now = new Date();
        setLastUpdated(now);
        try {
          localStorage.setItem(
            ADMIN_STATS_CACHE_KEY,
            JSON.stringify({ data: freshData, timestamp: now.toISOString() })
          );
        } catch {
          // ignore storage quota errors
        }
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      const isOffline =
        !err?.response &&
        (err?.code === "ERR_NETWORK" ||
          err?.message === "Network Error" ||
          (typeof navigator !== "undefined" && navigator.onLine === false));

      if (isOffline) {
        setError(
          "Network connection was interrupted. Data will refresh automatically as soon as your connection is restored."
        );
      } else if (err?.response?.status !== 401) {
        setError(
          err?.response?.data?.message ||
            "Unable to load latest statistics right now. Click Retry to try again."
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(false);
  }, [fetchStats]);

  // Automatically re-fetch when network reconnects or token refreshes
  useEffect(() => {
    const handleOnline = () => {
      fetchStats(true);
    };
    const handleTokenUpdated = () => {
      fetchStats(true);
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible" && error) {
        fetchStats(true);
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("cookeaze:token-updated", handleTokenUpdated);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("cookeaze:token-updated", handleTokenUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchStats, error]);

  // Extract metrics safely
  const users = stats?.users || {};
  const meals = stats?.meals || {};
  const topRecipes = useMemo(
    () => stats?.engagement?.top_recipes || [],
    [stats]
  );

  const totalRegistered = Number(users.total_registered || 0);
  const currentlyOnline = Number(users.currently_online || 0);
  const dau = Number(users["daily_active_users (DAU)"] || 0);
  const mau = Number(users["monthly_active_users (MAU)"] || 0);

  // Derived user ratios
  const stickinessRatio =
    mau > 0 ? ((dau / mau) * 100).toFixed(1) : "0.0";
  const mauPenetration =
    totalRegistered > 0 ? ((mau / totalRegistered) * 100).toFixed(1) : "0.0";
  const dauPenetration =
    totalRegistered > 0 ? ((dau / totalRegistered) * 100).toFixed(1) : "0.0";

  // Meal metrics
  const mealsStarted = Number(meals.total_started || 0);
  const mealsCompleted = Number(meals.total_completed || 0);
  const mealsCancelled = Number(meals.total_cancelled || 0);
  const mealsInProgress = Math.max(
    0,
    mealsStarted - mealsCompleted - mealsCancelled
  );

  const completionRate =
    mealsStarted > 0
      ? ((mealsCompleted / mealsStarted) * 100).toFixed(1)
      : "0.0";
  const cancellationRate =
    mealsStarted > 0
      ? ((mealsCancelled / mealsStarted) * 100).toFixed(1)
      : "0.0";
  const inProgressRate =
    mealsStarted > 0
      ? ((mealsInProgress / mealsStarted) * 100).toFixed(1)
      : "0.0";

  // Top recipes filtering & totals
  const totalTopCooked = useMemo(
    () =>
      topRecipes.reduce(
        (sum, r) => sum + Number(r.times_cooked || 0),
        0
      ),
    [topRecipes]
  );

  const filteredRecipes = useMemo(() => {
    const q = recipeQuery.trim().toLowerCase();
    if (!q) return topRecipes;
    return topRecipes.filter((r) =>
      String(r.recipe__name || "")
        .toLowerCase()
        .includes(q)
    );
  }, [topRecipes, recipeQuery]);

  // Chart configuration (flat solid fills, crisp grid lines)
  const barData = {
    labels: ["Started", "Completed", "Cancelled"],
    datasets: [
      {
        label: "Meals",
        data: [mealsStarted, mealsCompleted, mealsCancelled],
        backgroundColor: ["#2563eb", "#129575", "#e11d48"],
        borderRadius: 6,
        barThickness: 44,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#0f172a",
        padding: 10,
        cornerRadius: 6,
        displayColors: false,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: "#475569",
          font: { size: 12, weight: "600" },
        },
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: {
          color: "#f1f5f9",
        },
        ticks: {
          color: "#94a3b8",
          font: { size: 12 },
          precision: 0,
        },
      },
    },
  };

  const doughnutData = {
    labels: ["Completed", "In Progress", "Cancelled"],
    datasets: [
      {
        data:
          mealsStarted > 0
            ? [mealsCompleted, mealsInProgress, mealsCancelled]
            : [0, 0, 1],
        backgroundColor:
          mealsStarted > 0
            ? ["#129575", "#f59e0b", "#e11d48"]
            : ["#e2e8f0", "#e2e8f0", "#e2e8f0"],
        borderWidth: 2,
        borderColor: "#ffffff",
        hoverOffset: 2,
      },
    ],
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: "74%",
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: mealsStarted > 0,
        backgroundColor: "#0f172a",
        padding: 10,
        cornerRadius: 6,
        displayColors: true,
      },
    },
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="adm-header">
          <div>
            <h1 className="adm-title">Dashboard</h1>
            <p className="adm-subtitle">
              Platform activity, user engagement, and meal completion metrics.
            </p>
          </div>
        </div>

        <div className="adm-kpi-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="adm-kpi-card">
              <div className="adm-kpi-top">
                <div
                  className="adm-skeleton-block"
                  style={{ width: "55%", height: 14 }}
                />
                <div
                  className="adm-skeleton-block"
                  style={{ width: 36, height: 36, borderRadius: 8 }}
                />
              </div>
              <div
                className="adm-skeleton-block"
                style={{ width: "42%", height: 30 }}
              />
              <div className="adm-kpi-footer">
                <div
                  className="adm-skeleton-block"
                  style={{ width: "48%", height: 12 }}
                />
                <div
                  className="adm-skeleton-block"
                  style={{ width: "28%", height: 12 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="adm-main-grid">
          <div className="adm-panel">
            <div className="adm-panel-header">
              <div style={{ width: "100%" }}>
                <div
                  className="adm-skeleton-block"
                  style={{ width: 180, height: 16, marginBottom: 8 }}
                />
                <div
                  className="adm-skeleton-block"
                  style={{ width: 280, height: 12 }}
                />
              </div>
            </div>
            <div className="adm-panel-body">
              <div className="adm-meal-summary">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="adm-meal-stat">
                    <div
                      className="adm-skeleton-block"
                      style={{ width: "60%", height: 11, marginBottom: 8 }}
                    />
                    <div
                      className="adm-skeleton-block"
                      style={{ width: "45%", height: 20 }}
                    />
                  </div>
                ))}
              </div>
              <div
                className="adm-skeleton-block"
                style={{ width: "100%", height: 240, borderRadius: 8 }}
              />
            </div>
          </div>

          <div className="adm-panel">
            <div className="adm-panel-header">
              <div style={{ width: "100%" }}>
                <div
                  className="adm-skeleton-block"
                  style={{ width: 170, height: 16, marginBottom: 8 }}
                />
                <div
                  className="adm-skeleton-block"
                  style={{ width: 230, height: 12 }}
                />
              </div>
            </div>
            <div className="adm-panel-body">
              <div className="adm-breakdown-list">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="adm-breakdown-item">
                    <div className="adm-breakdown-head">
                      <div
                        className="adm-skeleton-block"
                        style={{ width: "52%", height: 13 }}
                      />
                      <div
                        className="adm-skeleton-block"
                        style={{ width: "24%", height: 13 }}
                      />
                    </div>
                    <div
                      className="adm-skeleton-block"
                      style={{ width: "100%", height: 8, borderRadius: 4 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="adm-panel">
          <div className="adm-panel-header">
            <div>
              <div
                className="adm-skeleton-block"
                style={{ width: 160, height: 16, marginBottom: 8 }}
              />
              <div
                className="adm-skeleton-block"
                style={{ width: 240, height: 12 }}
              />
            </div>
            <div
              className="adm-skeleton-block"
              style={{ width: 220, height: 36, borderRadius: 8 }}
            />
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 72 }}>Rank</th>
                  <th>Recipe Name</th>
                  <th style={{ width: 160 }}>Times Cooked</th>
                  <th style={{ width: 220 }}>Share of Top Cooks</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4, 5].map((row) => (
                  <tr key={row}>
                    <td>
                      <div
                        className="adm-skeleton-block"
                        style={{ width: 26, height: 26, borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      <div
                        className="adm-skeleton-block"
                        style={{ width: "55%", height: 14 }}
                      />
                    </td>
                    <td>
                      <div
                        className="adm-skeleton-block"
                        style={{ width: 48, height: 14 }}
                      />
                    </td>
                    <td>
                      <div
                        className="adm-skeleton-block"
                        style={{ width: "85%", height: 10 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      {/* Header */}
      <header className="adm-header">
        <div>
          <h1 className="adm-title">Dashboard</h1>
          <p className="adm-subtitle">
            Platform activity, user engagement, and meal completion metrics.
          </p>
        </div>

        <div className="adm-header-actions">
          {lastUpdated && (
            <span className="adm-timestamp">
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            className="adm-btn-refresh"
            onClick={() => fetchStats(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "adm-spin" : ""}
              aria-hidden="true"
            />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          <Link
            to="/finance"
            className="adm-btn-refresh"
            style={{ textDecoration: "none" }}
          >
            <span>Finance &amp; Withdrawals</span>
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="adm-error-banner" role="alert">
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="adm-btn-refresh"
            onClick={() => fetchStats(true)}
          >
            Retry
          </button>
        </div>
      )}

      {!error && stats && (
        <>
          {/* KPI Cards */}
          <section className="adm-kpi-grid" aria-label="Key Performance Indicators">
            <div className="adm-kpi-card">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">Total Registered Users</span>
                <div className="adm-kpi-icon adm-kpi-icon--teal">
                  <Users size={18} />
                </div>
              </div>
              <div className="adm-kpi-value">
                {totalRegistered.toLocaleString()}
              </div>
              <div className="adm-kpi-footer">
                <span>All-time accounts</span>
                <Link
                  to="/users"
                  className="adm-recipe-link d-inline-flex align-items-center gap-1"
                  style={{ fontSize: 12.5 }}
                >
                  View users <ArrowUpRight size={13} />
                </Link>
              </div>
            </div>

            <div className="adm-kpi-card">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">Currently Online</span>
                <div className="adm-kpi-icon adm-kpi-icon--emerald">
                  <Activity size={18} />
                </div>
              </div>
              <div className="adm-kpi-value">
                {currentlyOnline.toLocaleString()}
              </div>
              <div className="adm-kpi-footer">
                <span>
                  <span className="adm-live-dot" />
                  Active sessions now
                </span>
                <span className="adm-kpi-metric">
                  {dau > 0
                    ? `${((currentlyOnline / dau) * 100).toFixed(1)}% of DAU`
                    : "0% of DAU"}
                </span>
              </div>
            </div>

            <div className="adm-kpi-card">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">Daily Active Users (DAU)</span>
                <div className="adm-kpi-icon adm-kpi-icon--blue">
                  <Calendar size={18} />
                </div>
              </div>
              <div className="adm-kpi-value">{dau.toLocaleString()}</div>
              <div className="adm-kpi-footer">
                <span>24-hour active reach</span>
                <span className="adm-kpi-metric">{dauPenetration}% of total</span>
              </div>
            </div>

            <div className="adm-kpi-card">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">Monthly Active Users (MAU)</span>
                <div className="adm-kpi-icon adm-kpi-icon--amber">
                  <CalendarDays size={18} />
                </div>
              </div>
              <div className="adm-kpi-value">{mau.toLocaleString()}</div>
              <div className="adm-kpi-footer">
                <span>DAU / MAU stickiness</span>
                <span className="adm-kpi-metric">{stickinessRatio}%</span>
              </div>
            </div>
          </section>

          {/* Main 2-Column Section: Meal Activity + Funnel Breakdown */}
          <div className="adm-main-grid">
            {/* Meal Statistics Panel */}
            <section className="adm-panel">
              <div className="adm-panel-header">
                <div>
                  <h2 className="adm-panel-title">Meal Cooking Volume</h2>
                  <p className="adm-panel-desc">
                    Comparison of started, completed, and cancelled cooking sessions
                  </p>
                </div>
              </div>

              <div className="adm-panel-body">
                <div className="adm-meal-summary">
                  <div className="adm-meal-stat">
                    <div className="adm-meal-stat-label">Started</div>
                    <div className="adm-meal-stat-val">
                      {mealsStarted.toLocaleString()}
                    </div>
                  </div>
                  <div className="adm-meal-stat">
                    <div className="adm-meal-stat-label">Completed</div>
                    <div className="adm-meal-stat-val adm-meal-stat-val--emerald">
                      {mealsCompleted.toLocaleString()}
                    </div>
                  </div>
                  <div className="adm-meal-stat">
                    <div className="adm-meal-stat-label">Cancelled</div>
                    <div className="adm-meal-stat-val adm-meal-stat-val--rose">
                      {mealsCancelled.toLocaleString()}
                    </div>
                  </div>
                  <div className="adm-meal-stat">
                    <div className="adm-meal-stat-label">Completion</div>
                    <div className="adm-meal-stat-val">{completionRate}%</div>
                  </div>
                </div>

                <div className="adm-chart-container">
                  <Bar data={barData} options={barOptions} />
                </div>
              </div>
            </section>

            {/* Funnel & Retention Ratios Panel */}
            <section className="adm-panel">
              <div className="adm-panel-header">
                <div>
                  <h2 className="adm-panel-title">Conversion & Retention</h2>
                  <p className="adm-panel-desc">
                    Session outcomes and active user ratios
                  </p>
                </div>
              </div>

              <div className="adm-panel-body adm-conversion-body">
                {/* 1. Session Outcomes: Doughnut Ring + Clean Table */}
                <div className="adm-donut-row">
                  <div className="adm-donut-box">
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                    <div className="adm-donut-center">
                      <span className="adm-donut-total">
                        {mealsStarted.toLocaleString()}
                      </span>
                      <span className="adm-donut-sub">Sessions</span>
                    </div>
                  </div>

                  <div className="adm-legend-table">
                    <div className="adm-legend-row">
                      <div className="adm-legend-left">
                        <span className="adm-outcome-dot adm-outcome-dot--teal" />
                        <span className="adm-legend-name">Completed</span>
                      </div>
                      <span className="adm-legend-count">
                        {mealsCompleted.toLocaleString()}
                      </span>
                      <span className="adm-legend-pct">{completionRate}%</span>
                    </div>

                    <div className="adm-legend-row">
                      <div className="adm-legend-left">
                        <span className="adm-outcome-dot adm-outcome-dot--amber" />
                        <span className="adm-legend-name">In Progress</span>
                      </div>
                      <span className="adm-legend-count">
                        {mealsInProgress.toLocaleString()}
                      </span>
                      <span className="adm-legend-pct">{inProgressRate}%</span>
                    </div>

                    <div className="adm-legend-row">
                      <div className="adm-legend-left">
                        <span className="adm-outcome-dot adm-outcome-dot--rose" />
                        <span className="adm-legend-name">Cancelled</span>
                      </div>
                      <span className="adm-legend-count">
                        {mealsCancelled.toLocaleString()}
                      </span>
                      <span className="adm-legend-pct">
                        {cancellationRate}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="adm-divider" />

                {/* 2. Clean 2-Column Active User Ratios */}
                <div className="adm-ratio-grid">
                  <div className="adm-ratio-col">
                    <div className="adm-ratio-label">
                      Monthly Active Reach (MAU)
                    </div>
                    <div className="adm-ratio-val-row">
                      <span className="adm-ratio-val">{mauPenetration}%</span>
                      <span className="adm-ratio-fraction">
                        {mau.toLocaleString()} /{" "}
                        {totalRegistered.toLocaleString()} users
                      </span>
                    </div>
                    <div className="adm-progress-track">
                      <div
                        className="adm-progress-fill adm-progress-fill--blue"
                        style={{
                          width: `${Math.min(100, Number(mauPenetration))}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="adm-ratio-col">
                    <div className="adm-ratio-label">
                      User Stickiness (DAU / MAU)
                    </div>
                    <div className="adm-ratio-val-row">
                      <span className="adm-ratio-val">{stickinessRatio}%</span>
                      <span className="adm-ratio-fraction">
                        {dau.toLocaleString()} / {mau.toLocaleString()} active
                      </span>
                    </div>
                    <div className="adm-progress-track">
                      <div
                        className="adm-progress-fill adm-progress-fill--teal"
                        style={{
                          width: `${Math.min(100, Number(stickinessRatio))}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Top Recipes Panel */}
          <section className="adm-panel">
            <div className="adm-panel-header">
              <div className="d-flex align-items-center gap-2">
                <ChefHat size={18} color="#129575" />
                <div>
                  <h2 className="adm-panel-title">Top Cooked Recipes</h2>
                  <p className="adm-panel-desc">
                    Most frequently prepared recipes across the platform
                  </p>
                </div>
              </div>

              <div className="adm-search-box">
                <Search size={15} className="adm-search-icon" />
                <input
                  type="search"
                  className="adm-search-input"
                  placeholder="Filter recipes..."
                  value={recipeQuery}
                  onChange={(e) => setRecipeQuery(e.target.value)}
                  aria-label="Filter top recipes"
                />
              </div>
            </div>

            {filteredRecipes.length === 0 ? (
              <div className="adm-empty">
                {recipeQuery
                  ? `No recipes matching "${recipeQuery}".`
                  : "No top recipes data available."}
              </div>
            ) : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead>
                    <tr>
                      <th style={{ width: 72 }}>Rank</th>
                      <th>Recipe Name</th>
                      <th style={{ width: 160 }}>Times Cooked</th>
                      <th style={{ width: 220 }}>Share of Top Cooks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecipes.map((recipe, index) => {
                      const count = Number(recipe.times_cooked || 0);
                      const sharePct =
                        totalTopCooked > 0
                          ? ((count / totalTopCooked) * 100).toFixed(1)
                          : "0.0";
                      const isTopThree = index < 3 && !recipeQuery;

                      return (
                        <tr key={recipe.recipe__id || index}>
                          <td>
                            <span
                              className={`adm-rank${
                                isTopThree ? " adm-rank--top" : ""
                              }`}
                            >
                              {index + 1}
                            </span>
                          </td>
                          <td>
                            {recipe.recipe__id ? (
                              <Link
                                to={`/recipe/${recipe.recipe__id}`}
                                className="adm-recipe-link"
                              >
                                {recipe.recipe__name}
                              </Link>
                            ) : (
                              <span className="fw-semibold">
                                {recipe.recipe__name}
                              </span>
                            )}
                          </td>
                          <td className="fw-semibold">
                            {count.toLocaleString()}
                          </td>
                          <td>
                            <div className="adm-share-cell">
                              <div className="adm-share-bar">
                                <div
                                  className="adm-share-fill"
                                  style={{
                                    width: `${Math.min(100, Number(sharePct))}%`,
                                  }}
                                />
                              </div>
                              <span className="adm-share-pct">{sharePct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
