// src/components/Login.js
import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  ChefHat,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthProvider";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(() => {
    try {
      const notice = sessionStorage.getItem("cookeaze_auth_notice");
      if (notice) {
        sessionStorage.removeItem("cookeaze_auth_notice");
        return notice;
      }
    } catch {
      // ignore storage errors
    }
    return "";
  });
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const validateField = (name, value) => {
    if (name === "email") {
      if (!value.trim()) return "Email address is required.";
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
      return isValidEmail ? "" : "Please enter a valid email address.";
    }
    if (name === "password") {
      if (!value) return "Password is required.";
      return "";
    }
    return "";
  };

  const handleBlur = (e) => {
    const { name, value } = e.target;
    const message = validateField(name, value);
    setFieldErrors((prev) => ({ ...prev, [name]: message }));
  };

  const handleEmailChange = (e) => {
    const val = e.target.value;
    setEmail(val);
    if (fieldErrors.email) {
      setFieldErrors((prev) => ({ ...prev, email: "" }));
    }
    if (error) setError("");
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    if (fieldErrors.password) {
      setFieldErrors((prev) => ({ ...prev, password: "" }));
    }
    if (error) setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const emailErr = validateField("email", email);
    const passwordErr = validateField("password", password);
    if (emailErr || passwordErr) {
      setFieldErrors({ email: emailErr, password: passwordErr });
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const res = await axios.post("https://api.cookeaze.app/api/login/", {
        email: email.trim(),
        password,
      });

      if (res.data?.isSuccessful) {
        const token = res.data.data?.access || res.data.data?.token || "";
        const refreshToken =
          res.data.data?.refresh || res.data.data?.refresh_token || "";
        const user = res.data.data?.user || null;

        login({ token, refreshToken, user });
        navigate("/home");
      } else {
        setError(res.data?.message || "Sign in failed. Please check your credentials.");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          "Invalid email or password. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left Minimal Brand Panel */}
      <aside className="login-showcase" aria-label="Cookeaze Brand">
        <div className="login-showcase-overlay" />
        <div className="login-showcase-center">
          <div className="login-hero-mark">
            <ChefHat size={40} strokeWidth={1.8} />
          </div>
          <h2 className="login-hero-brand">Cookeaze</h2>
          <p className="login-hero-tagline">Admin Workspace</p>
        </div>
        <footer className="login-showcase-footer">
          <span>&copy; {new Date().getFullYear()} Cookeaze</span>
        </footer>
      </aside>

      {/* Right Sign-In Form Panel */}
      <section className="login-form-panel">
        <div className="login-form-wrapper">
          {/* Mobile Brand Header */}
          <div className="login-mobile-brand">
            <div className="login-mobile-brand-icon">
              <ChefHat size={22} />
            </div>
            <span className="login-mobile-brand-name">Cookeaze</span>
          </div>

          <div className="login-header">
            <h1 className="login-title">Sign in</h1>
            <p className="login-subtitle">
              Enter your administrator credentials to continue.
            </p>
          </div>

          {/* Live region for authentication errors */}
          <div aria-live="polite" aria-atomic="true">
            {error && (
              <div className="login-error-banner" role="alert">
                <AlertCircle size={18} className="login-error-icon" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} method="post" noValidate>
            {/* Email Field */}
            <div className="login-field-group">
              <div className="login-label-row">
                <label htmlFor="email" className="login-label">
                  Email address
                </label>
              </div>
              <div className="login-input-shell">
                <Mail size={18} className="login-input-icon" aria-hidden="true" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  enterKeyHint="next"
                  className="login-input"
                  placeholder="admin@cookeaze.app"
                  value={email}
                  onChange={handleEmailChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? "email-error" : undefined}
                  required
                  disabled={isSubmitting}
                />
              </div>
              {fieldErrors.email && (
                <div id="email-error" className="login-field-error" role="alert">
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{fieldErrors.email}</span>
                </div>
              )}
            </div>

            {/* Password Field */}
            <div className="login-field-group">
              <div className="login-label-row">
                <label htmlFor="current-password" className="login-label">
                  Password
                </label>
              </div>
              <div className="login-input-shell">
                <Lock size={18} className="login-input-icon" aria-hidden="true" />
                <input
                  id="current-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  className="login-input login-input--with-toggle"
                  placeholder="Enter your password"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={handleBlur}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "password-error" : undefined
                  }
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="login-pw-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-describedby="toggle-pw-warning"
                >
                  {showPassword ? (
                    <EyeOff size={18} aria-hidden="true" />
                  ) : (
                    <Eye size={18} aria-hidden="true" />
                  )}
                </button>
                <span id="toggle-pw-warning" className="visually-hidden">
                  Warning: this will display your password on the screen.
                </span>
              </div>
              {fieldErrors.password && (
                <div
                  id="password-error"
                  className="login-field-error"
                  role="alert"
                >
                  <AlertCircle size={14} aria-hidden="true" />
                  <span>{fieldErrors.password}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="login-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="login-spinner" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Login;
