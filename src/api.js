// src/api.js
import axios from "axios";

const API_BASE = "https://api.cookeaze.app/api";

// Optional fallback token for testing (used only if no localStorage token)
const DEFAULT_TOKEN = "YOUR_BEARER_TOKEN_HERE"; // Replace if needed for manual testing

// Create an Axios instance with dynamic or fallback authorization
export function getAxiosInstance() {
  const token = localStorage.getItem("token") || DEFAULT_TOKEN;

  return axios.create({
    baseURL: API_BASE,
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}



// (Optional) If you ever want a single reusable instance:
export const axiosInstance = axios.create({
  baseURL: API_BASE,
  headers: {
    Accept: "application/json",
  },
});

// Automatically inject the token for every request made via axiosInstance
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || DEFAULT_TOKEN;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
