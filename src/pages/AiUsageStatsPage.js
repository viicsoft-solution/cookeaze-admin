// src/pages/AiUsageStatsPage.js
import React, { useEffect, useMemo, useState } from "react";
import "./AiUsageStatsPage.css";

const API_URL = "https://api.cookeaze.app/api/v2/admin/ai-usage/stats/";

const AiUsageStatsPage = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const token = localStorage.getItem("token"); // adjust if your token key is different

  const fetchStats = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      const response = await fetch(API_URL, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.message || "Failed to fetch AI usage statistics.",
        );
      }

      if (!result?.isSuccessful) {
        throw new Error(result?.message || "Request was not successful.");
      }

      setStats(result.data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formattedCost = useMemo(() => {
    return `$${Number(stats?.total_cost_usd || 0).toFixed(6)}`;
  }, [stats]);

  const formattedTokens = useMemo(() => {
    return Number(stats?.total_tokens || 0).toLocaleString();
  }, [stats]);

  const formattedRequests = useMemo(() => {
    return Number(stats?.total_requests || 0).toLocaleString();
  }, [stats]);

  if (loading) {
    return (
      <div className="ai-usage-page">
        <div className="ai-usage-container">
          <div className="page-header">
            <div>
              <h1>AI Usage Statistics</h1>
              <p>Monitor token usage, request volume, and AI cost.</p>
            </div>
          </div>

          <div className="skeleton-grid">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>

          <div className="skeleton-table" />
          <div className="skeleton-table" />
        </div>
      </div>
    );
  }

  return (
    <div className="ai-usage-page">
      <div className="ai-usage-container">
        <div className="page-header">
          <div>
            <h1>AI Usage Statistics</h1>
            <p>Monitor Gemini AI requests, token usage, and total spend.</p>
          </div>

          <button
            className="refresh-btn"
            onClick={() => fetchStats(true)}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {!error && stats && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Total Requests</div>
                <div className="stat-value">{formattedRequests}</div>
                <div className="stat-subtext">All AI requests made</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Total Cost</div>
                <div className="stat-value">{formattedCost}</div>
                <div className="stat-subtext">Accumulated AI spend in USD</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Total Tokens</div>
                <div className="stat-value">{formattedTokens}</div>
                <div className="stat-subtext">Combined input/output usage</div>
              </div>
            </div>

            <div className="content-grid">
              <div className="panel">
                <div className="panel-header">
                  <h2>Breakdown by Request Type</h2>
                </div>

                {stats.breakdown_by_type?.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Request Type</th>
                          <th>Count</th>
                          <th>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.breakdown_by_type.map((item, index) => (
                          <tr key={`${item.request_type}-${index}`}>
                            <td>
                              <span className="tag">
                                {item.request_type?.replaceAll("_", " ")}
                              </span>
                            </td>
                            <td>{Number(item.count || 0).toLocaleString()}</td>
                            <td>${Number(item.cost || 0).toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No request type data available.
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Breakdown by Model</h2>
                </div>

                {stats.breakdown_by_model?.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Model</th>
                          <th>Count</th>
                          <th>Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.breakdown_by_model.map((item, index) => (
                          <tr key={`${item.model}-${index}`}>
                            <td>
                              <span className="tag secondary">
                                {item.model}
                              </span>
                            </td>
                            <td>{Number(item.count || 0).toLocaleString()}</td>
                            <td>${Number(item.cost || 0).toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">
                    No model breakdown data available.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AiUsageStatsPage;
