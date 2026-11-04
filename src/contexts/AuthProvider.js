// src/contexts/AuthProvider.js
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  getJwtRemainingMs,
  isJwtExpired,
  notifySessionExpired,
  tryRefreshAccessToken,
} from "../api";

const AuthContext = createContext(null);

function getInitialValidToken() {
  const rawToken = localStorage.getItem("token");
  if (!rawToken || rawToken === "YOUR_BEARER_TOKEN_HERE") {
    return null;
  }

  if (!isJwtExpired(rawToken, 5)) {
    return rawToken;
  }

  // Access token is expired; check if we have a non-expired refresh token
  const rawRefresh = localStorage.getItem("refresh_token");
  if (rawRefresh && !isJwtExpired(rawRefresh, 5)) {
    return rawToken; // Will be refreshed immediately by useEffect
  }

  // Both access and refresh tokens are expired/missing -> clear stale session
  localStorage.removeItem("token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user");
  try {
    sessionStorage.setItem(
      "cookeaze_auth_notice",
      "Your session has expired. Please sign in again to continue."
    );
  } catch {
    // ignore storage errors
  }
  return null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => getInitialValidToken());
  const [user, setUser] = useState(() => {
    const validTok = getInitialValidToken();
    if (!validTok) return null;
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine !== false : true
  );

  // Sync token to localStorage
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  // Sync user to localStorage
  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const validateOrRefreshSession = useCallback(async () => {
    const currentTok = localStorage.getItem("token");
    if (!currentTok) {
      setToken(null);
      setUser(null);
      return false;
    }

    if (!isJwtExpired(currentTok, 30)) {
      if (token !== currentTok) setToken(currentTok);
      return true;
    }

    // Don't force logout while browser is offline
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return false;
    }

    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      setToken(refreshed);
      return true;
    }

    notifySessionExpired(
      "Your session has expired. Please sign in again to continue."
    );
    return false;
  }, [token]);

  // Proactive timer before JWT expiration
  useEffect(() => {
    if (!token) return undefined;

    if (isJwtExpired(token, 15)) {
      validateOrRefreshSession();
      return undefined;
    }

    const remainingMs = getJwtRemainingMs(token);
    if (remainingMs === null) return undefined;

    // Trigger refresh/validation 30s before expiry (minimum 2s)
    const delay = Math.max(2000, remainingMs - 30000);
    const timer = setTimeout(() => {
      validateOrRefreshSession();
    }, delay);

    return () => clearTimeout(timer);
  }, [token, validateOrRefreshSession]);

  // Global event listeners for session expiry, token refresh, cross-tab storage, and network recovery
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setUser(null);
    };

    const handleTokenUpdated = (e) => {
      const nextToken = e?.detail?.token || localStorage.getItem("token");
      if (nextToken) {
        setToken(nextToken);
      }
    };

    const handleStorageChange = (e) => {
      if (e.key === "token") {
        setToken(e.newValue || null);
        if (!e.newValue) setUser(null);
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      validateOrRefreshSession();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        validateOrRefreshSession();
      }
    };

    window.addEventListener("cookeaze:session-expired", handleSessionExpired);
    window.addEventListener("cookeaze:token-updated", handleTokenUpdated);
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener(
        "cookeaze:session-expired",
        handleSessionExpired
      );
      window.removeEventListener("cookeaze:token-updated", handleTokenUpdated);
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [validateOrRefreshSession]);

  const login = ({
    token: newToken,
    refreshToken: newRefresh,
    user: newUser,
  }) => {
    if (newToken) localStorage.setItem("token", newToken);
    if (newRefresh) localStorage.setItem("refresh_token", newRefresh);
    try {
      sessionStorage.removeItem("cookeaze_auth_notice");
    } catch {
      // ignore
    }
    setToken(newToken);
    setUser(newUser || null);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isOnline,
        login,
        logout,
        validateOrRefreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
