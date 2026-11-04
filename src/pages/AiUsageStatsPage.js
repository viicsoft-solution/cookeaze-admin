// src/pages/AiUsageStatsPage.js
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  DollarSign,
  Cpu,
  Calculator,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { getAxiosInstance } from "../api";
import "./AiUsageStatsPage.css";

const API_URL = "https://api.cookeaze.app/api/v2/admin/ai-usage/stats/";
const AI_STATS_CACHE_KEY = "cookeaze_ai_stats_cache_v1";

function getCachedAiStats() {
  try {
    const raw = localStorage.getItem(AI_STATS_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

const AiUsageStatsPage = () => {
  const initialCached = getCachedAiStats();
  const [stats, setStats] = useState(() => initialCached?.data || null);
  const [loading, setLoading] = useState(() => !initialCached?.data);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(() =>
    initialCached?.timestamp ? new Date(initialCached.timestamp) : null
  );

  const fetchStats = useCallback(async (isRefresh = false) => {
    const hasCached = Boolean(getCachedAiStats()?.data);
    try {
      if (isRefresh || hasCached) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      const API = getAxiosInstance();
      const res = await API.get(API_URL);
      const result = res.data;

      if (!result?.isSuccessful) {
        throw new Error(result?.message || "Request was not successful.");
      }

      setStats(result.data);
      const now = new Date();
      setLastUpdated(now);
      try {
        localStorage.setItem(
          AI_STATS_CACHE_KEY,
          JSON.stringify({ data: result.data, timestamp: now.toISOString() })
        );
      } catch {
        // ignore storage quota errors
      }
    } catch (err) {
      const isOffline =
        !err?.response &&
        (err?.code === "ERR_NETWORK" ||
          err?.message === "Network Error" ||
          (typeof navigator !== "undefined" && navigator.onLine === false));

      if (isOffline) {
        setError(
          "Network connection was interrupted. Data will refresh automatically once your connection returns."
        );
      } else if (err?.response?.status !== 401) {
        setError(
          err?.response?.data?.message ||
            err.message ||
            "Unable to load AI usage statistics."
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
    const handleOnline = () => fetchStats(true);
    const handleTokenUpdated = () => fetchStats(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("cookeaze:token-updated", handleTokenUpdated);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("cookeaze:token-updated", handleTokenUpdated);
    };
  }, [fetchStats]);

  // Derived numerical totals
  const totalRequests = Number(stats?.total_requests || 0);
  const totalCost = Number(stats?.total_cost_usd || 0);
  const totalTokens = Number(stats?.total_tokens || 0);

  const avgCostPerRequest =
    totalRequests > 0 ? totalCost / totalRequests : 0;
  const avgTokensPerRequest =
    totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0;
  const costPer1kTokens =
    totalTokens > 0 ? (totalCost / totalTokens) * 1000 : 0;

  const breakdownByType = useMemo(
    () => stats?.breakdown_by_type || [],
    [stats]
  );

  const breakdownByModel = useMemo(
    () => stats?.breakdown_by_model || [],
    [stats]
  );

  // Shimmer loading state matching exact page layout
  if (loading) {
    return (
      <div className="ai-usage-page">
        <header className="ai-header">
          <div>
            <h1 className="ai-title">AI Usage Statistics</h1>
            <p className="ai-subtitle">
              Request volume, token consumption, and cost telemetry across models.
            </p>
          </div>
          <div
            className="shimmer"
            style={{ width: 104, height: 38, borderRadius: 8 }}
          />
        </header>

        <div className="ai-kpi-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="ai-kpi-card">
              <div className="ai-kpi-top">
                <div
                  className="shimmer"
                  style={{ width: "52%", height: 14 }}
                />
                <div
                  className="shimmer"
                  style={{ width: 36, height: 36, borderRadius: 8 }}
                />
              </div>
              <div
                className="shimmer"
                style={{ width: "45%", height: 30 }}
              />
              <div className="ai-kpi-footer">
                <div
                  className="shimmer"
                  style={{ width: "48%", height: 12 }}
                />
                <div
                  className="shimmer"
                  style={{ width: "28%", height: 12 }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="ai-panels-grid">
          {[1, 2].map((panelIdx) => (
            <div key={panelIdx} className="ai-panel">
              <div className="ai-panel-header">
                <div>
                  <div
                    className="shimmer"
                    style={{ width: 190, height: 16, marginBottom: 8 }}
                  />
                  <div
                    className="shimmer"
                    style={{ width: 250, height: 12 }}
                  />
                </div>
                <div
                  className="shimmer"
                  style={{ width: 64, height: 26, borderRadius: 6 }}
                />
              </div>
              <div className="ai-table-wrap">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Requests</th>
                      <th>Cost (USD)</th>
                      <th>Volume Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((row) => (
                      <tr key={row}>
                        <td>
                          <div
                            className="shimmer"
                            style={{ width: "65%", height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="shimmer"
                            style={{ width: 48, height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="shimmer"
                            style={{ width: 72, height: 14 }}
                          />
                        </td>
                        <td>
                          <div
                            className="shimmer"
                            style={{ width: "85%", height: 10 }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="ai-usage-page">
      {/* Header */}
      <header className="ai-header">
        <div>
          <h1 className="ai-title">AI Usage Statistics</h1>
          <p className="ai-subtitle">
            Request volume, token consumption, and cost telemetry across models.
          </p>
        </div>

        <div className="ai-header-actions">
          {lastUpdated && (
            <span className="ai-timestamp">
              Updated{" "}
              {lastUpdated.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          <button
            type="button"
            className="ai-btn-refresh"
            onClick={() => fetchStats(true)}
            disabled={refreshing}
          >
            <RefreshCw
              size={15}
              className={refreshing ? "ai-spin" : ""}
              aria-hidden="true"
            />
            <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <div className="ai-error-banner" role="alert">
          <div className="d-flex align-items-center gap-2">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="ai-btn-refresh"
            onClick={() => fetchStats(true)}
          >
            Retry
          </button>
        </div>
      )}

      {!error && stats && (
        <>
          {/* KPI Cards */}
          <section className="ai-kpi-grid" aria-label="AI Usage Summary">
            <div className="ai-kpi-card">
              <div className="ai-kpi-top">
                <span className="ai-kpi-label">Total Requests</span>
                <div className="ai-kpi-icon ai-kpi-icon--teal">
                  <Activity size={18} />
                </div>
              </div>
              <div className="ai-kpi-value">
                {totalRequests.toLocaleString()}
              </div>
              <div className="ai-kpi-footer">
                <span>All recorded calls</span>
                <span className="ai-kpi-metric">
                  {breakdownByType.length} request types
                </span>
              </div>
            </div>

            <div className="ai-kpi-card">
              <div className="ai-kpi-top">
                <span className="ai-kpi-label">Total Spend (USD)</span>
                <div className="ai-kpi-icon ai-kpi-icon--emerald">
                  <DollarSign size={18} />
                </div>
              </div>
              <div className="ai-kpi-value">${totalCost.toFixed(6)}</div>
              <div className="ai-kpi-footer">
                <span>Cost per 1K tokens</span>
                <span className="ai-kpi-metric">
                  ${costPer1kTokens.toFixed(6)}
                </span>
              </div>
            </div>

            <div className="ai-kpi-card">
              <div className="ai-kpi-top">
                <span className="ai-kpi-label">Total Tokens</span>
                <div className="ai-kpi-icon ai-kpi-icon--blue">
                  <Cpu size={18} />
                </div>
              </div>
              <div className="ai-kpi-value">
                {totalTokens.toLocaleString()}
              </div>
              <div className="ai-kpi-footer">
                <span>Avg tokens / request</span>
                <span className="ai-kpi-metric">
                  {avgTokensPerRequest.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="ai-kpi-card">
              <div className="ai-kpi-top">
                <span className="ai-kpi-label">Avg Cost / Request</span>
                <div className="ai-kpi-icon ai-kpi-icon--amber">
                  <Calculator size={18} />
                </div>
              </div>
              <div className="ai-kpi-value">
                ${avgCostPerRequest.toFixed(6)}
              </div>
              <div className="ai-kpi-footer">
                <span>Active models</span>
                <span className="ai-kpi-metric">
                  {breakdownByModel.length}
                </span>
              </div>
            </div>
          </section>

          {/* Breakdown Panels */}
          <div className="ai-panels-grid">
            {/* Breakdown by Request Type */}
            <section className="ai-panel">
              <div className="ai-panel-header">
                <div>
                  <h2 className="ai-panel-title">Breakdown by Request Type</h2>
                  <p className="ai-panel-desc">
                    Call volume, spend, and share across feature operations
                  </p>
                </div>
                <span className="ai-panel-count">
                  {breakdownByType.length} types
                </span>
              </div>

              {breakdownByType.length > 0 ? (
                <div className="ai-table-wrap">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Request Type</th>
                        <th>Requests</th>
                        <th>Cost (USD)</th>
                        <th>Volume Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownByType.map((item, index) => {
                        const count = Number(item.count || 0);
                        const cost = Number(item.cost || 0);
                        const sharePct =
                          totalRequests > 0
                            ? ((count / totalRequests) * 100).toFixed(1)
                            : "0.0";

                        return (
                          <tr key={`${item.request_type}-${index}`}>
                            <td>
                              <span className="ai-name-text">
                                {item.request_type?.replaceAll("_", " ") ||
                                  "Unknown"}
                              </span>
                            </td>
                            <td>{count.toLocaleString()}</td>
                            <td>${cost.toFixed(6)}</td>
                            <td>
                              <div className="ai-share-cell">
                                <div className="ai-share-track">
                                  <div
                                    className="ai-share-fill"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Number(sharePct)
                                      )}%`,
                                    }}
                                  />
                                </div>
                                <span className="ai-share-pct">
                                  {sharePct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td>{totalRequests.toLocaleString()}</td>
                        <td>${totalCost.toFixed(6)}</td>
                        <td>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="ai-empty">
                  No request type breakdown data available.
                </div>
              )}
            </section>

            {/* Breakdown by Model */}
            <section className="ai-panel">
              <div className="ai-panel-header">
                <div>
                  <h2 className="ai-panel-title">Breakdown by Model</h2>
                  <p className="ai-panel-desc">
                    Distribution of requests and spend by model identifier
                  </p>
                </div>
                <span className="ai-panel-count">
                  {breakdownByModel.length} models
                </span>
              </div>

              {breakdownByModel.length > 0 ? (
                <div className="ai-table-wrap">
                  <table className="ai-table">
                    <thead>
                      <tr>
                        <th>Model</th>
                        <th>Requests</th>
                        <th>Cost (USD)</th>
                        <th>Cost Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdownByModel.map((item, index) => {
                        const count = Number(item.count || 0);
                        const cost = Number(item.cost || 0);
                        const costSharePct =
                          totalCost > 0
                            ? ((cost / totalCost) * 100).toFixed(1)
                            : totalRequests > 0
                              ? ((count / totalRequests) * 100).toFixed(1)
                              : "0.0";

                        return (
                          <tr key={`${item.model}-${index}`}>
                            <td>
                              <span className="ai-model-code">
                                {item.model || "Unknown"}
                              </span>
                            </td>
                            <td>{count.toLocaleString()}</td>
                            <td>${cost.toFixed(6)}</td>
                            <td>
                              <div className="ai-share-cell">
                                <div className="ai-share-track">
                                  <div
                                    className="ai-share-fill ai-share-fill--blue"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        Number(costSharePct)
                                      )}%`,
                                    }}
                                  />
                                </div>
                                <span className="ai-share-pct">
                                  {costSharePct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td>{totalRequests.toLocaleString()}</td>
                        <td>${totalCost.toFixed(6)}</td>
                        <td>100%</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="ai-empty">
                  No model breakdown data available.
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default AiUsageStatsPage;
