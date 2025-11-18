// src/pages/AdminDashboard.js
import React, { useEffect, useState } from "react";
import { getAxiosInstance } from "../api";
import { Bar } from "react-chartjs-2";
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import "chartjs-adapter-date-fns";

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function AdminDashboard() {
  const API = getAxiosInstance();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await API.get("/analytics/statistics/");
      setStats(res.data?.data);
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
      setError("Failed to load admin statistics. Ensure your token is valid.");
    } finally {
      setLoading(false);
    }
  };

  if (loading)
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );

  if (error)
    return <div className="alert alert-danger text-center mt-5">{error}</div>;

  if (!stats)
    return (
      <div className="alert alert-warning text-center mt-5">
        No statistics found.
      </div>
    );

  // Extract data safely
  const users = stats.users || {};
  const meals = stats.meals || {};
  const topRecipes = stats.engagement?.top_recipes || [];

  // Prepare chart data
  const barData = {
    labels: ["Started", "Completed", "Cancelled"],
    datasets: [
      {
        label: "Meals",
        data: [
          meals.total_started || 0,
          meals.total_completed || 0,
          meals.total_cancelled || 0,
        ],
        backgroundColor: [
          "rgba(54, 162, 235, 0.7)",
          "rgba(75, 192, 192, 0.7)",
          "rgba(255, 99, 132, 0.7)",
        ],
      },
    ],
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold mb-1">Admin Dashboard</h3>
          <small className="text-muted">Cookeaze App Analytics Overview</small>
        </div>
        <button className="btn btn-outline-primary btn-sm" onClick={fetchStats}>
          <i className="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm border-0 p-3 h-100">
            <div className="d-flex align-items-center">
              <div
                className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{ width: 48, height: 48 }}
              >
                <i className="bi bi-people-fill fs-5"></i>
              </div>
              <div>
                <div className="text-muted small">Total Users</div>
                <h5 className="mb-0">{users.total_registered}</h5>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm border-0 p-3 h-100">
            <div className="d-flex align-items-center">
              <div
                className="bg-success text-white rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{ width: 48, height: 48 }}
              >
                <i className="bi bi-circle-fill fs-6"></i>
              </div>
              <div>
                <div className="text-muted small">Currently Online</div>
                <h5 className="mb-0">{users.currently_online}</h5>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm border-0 p-3 h-100">
            <div className="d-flex align-items-center">
              <div
                className="bg-warning text-white rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{ width: 48, height: 48 }}
              >
                <i className="bi bi-calendar-day fs-5"></i>
              </div>
              <div>
                <div className="text-muted small">Daily Active Users (DAU)</div>
                <h5 className="mb-0">{users["daily_active_users (DAU)"]}</h5>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-3">
          <div className="card shadow-sm border-0 p-3 h-100">
            <div className="d-flex align-items-center">
              <div
                className="bg-danger text-white rounded-circle d-flex align-items-center justify-content-center me-3"
                style={{ width: 48, height: 48 }}
              >
                <i className="bi bi-calendar-month fs-5"></i>
              </div>
              <div>
                <div className="text-muted small">
                  Monthly Active Users (MAU)
                </div>
                <h5 className="mb-0">{users["monthly_active_users (MAU)"]}</h5>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Meals Chart */}
      <div className="card shadow-sm border-0 p-4 mb-4">
        <h5 className="mb-3">Meal Statistics</h5>
        <Bar
          data={barData}
          options={{
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
              y: { beginAtZero: true, title: { display: true, text: "Count" } },
            },
          }}
          height={100}
        />
      </div>

      {/* Top Recipes */}
      <div className="card shadow-sm border-0 p-4">
        <h5 className="mb-3">Top Recipes</h5>
        {topRecipes.length === 0 ? (
          <p className="text-muted">No top recipes data available.</p>
        ) : (
          <table className="table table-striped table-sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Recipe Name</th>
                <th>Times Cooked</th>
              </tr>
            </thead>
            <tbody>
              {topRecipes.map((recipe, index) => (
                <tr key={recipe.recipe__id || index}>
                  <td>{index + 1}</td>
                  <td>{recipe.recipe__name}</td>
                  <td>{recipe.times_cooked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
