// src/api.js
import axios from "axios";

export const API_BASE = "https://api.cookeaze.app/api";

const TOKEN_REFRESH_ENDPOINTS = [
  `${API_BASE}/token/refresh/`,
  `${API_BASE}/login/refresh/`,
];

let activeRefreshPromise = null;

/**
 * Decode a JWT token payload safely without external dependencies.
 */
export function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );
    const jsonPayload = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Returns true if the JWT token has an `exp` claim that is already expired
 * (or will expire within `bufferSeconds`).
 */
export function isJwtExpired(token, bufferSeconds = 10) {
  if (!token || token === "YOUR_BEARER_TOKEN_HERE") return true;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") {
    // Non-JWT opaque token: assume valid until server says 401
    return false;
  }
  const nowMs = Date.now();
  const expMs = payload.exp * 1000;
  return expMs <= nowMs + bufferSeconds * 1000;
}

/**
 * Returns the remaining milliseconds before JWT expiration, or null if unknown.
 */
export function getJwtRemainingMs(token) {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number") return null;
  return Math.max(0, payload.exp * 1000 - Date.now());
}

/**
 * Clear stored credentials and broadcast session expiration across the app.
 */
export function notifySessionExpired(
  reason = "Your session has expired. Please sign in again to continue."
) {
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  try {
    sessionStorage.setItem("cookeaze_auth_notice", reason);
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent("cookeaze:session-expired", { detail: { reason } })
  );
}

/**
 * Attempt to refresh the access token using a stored refresh_token.
 * Returns the new access token string or null if refresh is not possible.
 */
export async function tryRefreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken || isJwtExpired(refreshToken, 5)) {
    return null;
  }

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    for (const url of TOKEN_REFRESH_ENDPOINTS) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (res.ok) {
          const data = await res.json();
          const newAccess =
            data?.data?.access ||
            data?.access ||
            data?.data?.token ||
            data?.token;
          const newRefresh = data?.data?.refresh || data?.refresh;

          if (newAccess) {
            localStorage.setItem("token", newAccess);
            if (newRefresh) {
              localStorage.setItem("refresh_token", newRefresh);
            }
            window.dispatchEvent(
              new CustomEvent("cookeaze:token-updated", {
                detail: { token: newAccess },
              })
            );
            return newAccess;
          }
        } else if (res.status === 401 || res.status === 400) {
          break;
        }
      } catch {
        // Network error during refresh — don't invalidate session if offline
        return null;
      }
    }
    return null;
  })().finally(() => {
    activeRefreshPromise = null;
  });

  return activeRefreshPromise;
}

/**
 * Ensure we have a valid access token before making an authenticated request.
 */
export async function ensureValidToken() {
  const currentToken = localStorage.getItem("token");
  if (!currentToken || currentToken === "YOUR_BEARER_TOKEN_HERE") {
    return null;
  }

  if (!isJwtExpired(currentToken, 15)) {
    return currentToken;
  }

  // Token is expired; attempt refresh if online
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return currentToken;
  }

  const refreshed = await tryRefreshAccessToken();
  if (refreshed) {
    return refreshed;
  }

  // Token is expired and could not be refreshed
  notifySessionExpired(
    "Your session has expired. Please sign in again to continue."
  );
  return null;
}

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Wait briefly for the browser to come back online if disconnected.
 */
function waitForOnlineOrTimeout(timeoutMs = 3500) {
  if (typeof navigator === "undefined" || navigator.onLine !== false) {
    return waitMs(900);
  }
  return new Promise((resolve) => {
    let settled = false;
    const onOnline = () => {
      if (!settled) {
        settled = true;
        window.removeEventListener("online", onOnline);
        resolve();
      }
    };
    window.addEventListener("online", onOnline);
    setTimeout(() => {
      if (!settled) {
        settled = true;
        window.removeEventListener("online", onOnline);
        resolve();
      }
    }, timeoutMs);
  });
}

/**
 * Attach request & response interceptors to any Axios instance for:
 * 1) Dynamic latest token injection + proactive expiry check
 * 2) Automatic retry on transient network drops for GET requests
 * 3) Automatic 401 token refresh or clean session expiration redirect
 */
export function attachSessionInterceptors(instance) {
  if (!instance || instance.__cookeazeInterceptorsAttached) return instance;
  instance.__cookeazeInterceptorsAttached = true;

  instance.interceptors.request.use(async (config) => {
    const urlStr = String(config.url || "");
    const isLoginEndpoint = urlStr.includes("/login");
    if (isLoginEndpoint) return config;

    const validToken = await ensureValidToken();
    config.headers = config.headers || {};
    if (validToken) {
      config.headers.Authorization = `Bearer ${validToken}`;
    } else {
      delete config.headers.Authorization;
    }
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error?.config;
      if (!originalRequest) return Promise.reject(error);

      const urlStr = String(originalRequest.url || "");
      const isLoginEndpoint = urlStr.includes("/login");

      // 1) Transient Network Error / Reconnection Retry for GET requests
      const isNetworkError =
        !error.response &&
        (error.code === "ERR_NETWORK" ||
          error.message === "Network Error" ||
          (typeof navigator !== "undefined" && navigator.onLine === false));

      const method = String(originalRequest.method || "get").toLowerCase();
      if (isNetworkError && method === "get") {
        originalRequest.__retryCount = (originalRequest.__retryCount || 0) + 1;
        if (originalRequest.__retryCount <= 2) {
          await waitForOnlineOrTimeout(2500);
          return instance(originalRequest);
        }
      }

      // 2) 401 Unauthorized or expired JWT 403
      const status = error.response?.status;
      const errCode = error.response?.data?.code || "";
      const errDetail = String(
        error.response?.data?.detail || error.response?.data?.message || ""
      ).toLowerCase();

      const isAuthFailure =
        !isLoginEndpoint &&
        (status === 401 ||
          (status === 403 &&
            (errCode === "token_not_valid" ||
              errDetail.includes("token") ||
              errDetail.includes("expired") ||
              errDetail.includes("credentials were not provided"))));

      if (isAuthFailure && !originalRequest.__isAuthRetry) {
        originalRequest.__isAuthRetry = true;
        const refreshedToken = await tryRefreshAccessToken();
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return instance(originalRequest);
        }

        notifySessionExpired(
          "Your session has expired. Please sign in again to continue."
        );
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

// Attach to global default axios as well so direct `axios.get(...)` calls are protected
attachSessionInterceptors(axios);

export const axiosInstance = attachSessionInterceptors(
  axios.create({
    baseURL: API_BASE,
    headers: {
      Accept: "application/json",
    },
  })
);

export function getAxiosInstance() {
  return axiosInstance;
}
