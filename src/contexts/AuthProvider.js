// src/contexts/AuthProvider.js
import React, { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // initialize from localStorage (safe on client)
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  // keep localStorage in sync when token/user change
  useEffect(() => {
    if (token) localStorage.setItem("token", token);
    else localStorage.removeItem("token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("user", JSON.stringify(user));
    else localStorage.removeItem("user");
  }, [user]);

  const login = ({ token: newToken, user: newUser }) => {
    setToken(newToken);
    setUser(newUser || null);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    // localStorage keys removed by effects above, but do it explicitly too:
    localStorage.removeItem("token");
    localStorage.removeItem("user");
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// hook for convenience
export function useAuth() {
  return useContext(AuthContext);
}
