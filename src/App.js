// src/App.js
import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthProvider";
import TopNav from "./components/TopNav";
import PrivateRoute from "./PrivateRoute";

// your existing components
import Login from "./components/Login";
import Home from "./components/Home";
import RecipeList from "./components/RecipeList";
import RecipeThemesDashboard from "./components/Recipe_themes_dashboard";
import RecipeCreate from "./components/RecipeCreate";
import RecipeDetail from "./components/RecipeDetail";

// adverts pages
import AdvertsList from "./pages/AdvertsList";
import AdvertDetail from "./pages/AdvertDetail";
import AdvertForm from "./pages/AdvertForm";
import NotificationAdmin from "./pages/Notifications";

// admin & categories
import AdminDashboard from "./pages/AdminDashboard";
import CategoriesList from "./pages/CategoriesList";
import CategoryForm from "./pages/CategoryForm";
import CategoryDetail from "./pages/CategoryDetail";

// feed pages (new)
import FeedListPage from "./pages/FeedListPage";
import FeedDetailPage from "./pages/FeedDetailPage";
import FeedAdminPage from "./pages/FeedAdminPage";

import AdminUsersPage from "./pages/UsersPage";
import AdminChangePasswordPage from "./pages/ChangePasswordPage";
import AdminChangeRolePage from "./pages/ChangeRolePage";

import AiUsageStatsPage from "./pages/AiUsageStatsPage";

// small helper for "/" route to preserve your existing logic
function LoginOrRedirect() {
  const { token } = useAuth();
  return token ? <Navigate to="/home" replace /> : <Login />;
}

function AppRoutes() {
  return (
    <>
      <TopNav />

      <div className="container py-4">
        <Routes>
          <Route path="/" element={<LoginOrRedirect />} />

          <Route
            path="/home"
            element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            }
          />

          <Route
            path="/recipe"
            element={
              <PrivateRoute>
                <RecipeList />
              </PrivateRoute>
            }
          />
          <Route
            path="/ai"
            element={
              <PrivateRoute>
                <AiUsageStatsPage />
              </PrivateRoute>
            }
          />

          {/* Recipes */}
          <Route
            path="/recipe-theme"
            element={
              <PrivateRoute>
                <RecipeThemesDashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/create-recipe"
            element={
              <PrivateRoute>
                <RecipeCreate />
              </PrivateRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <PrivateRoute>
                <NotificationAdmin />
              </PrivateRoute>
            }
          />

          <Route
            path="/recipe/:id"
            element={
              <PrivateRoute>
                <RecipeDetail />
              </PrivateRoute>
            }
          />

          {/* Adverts */}
          <Route
            path="/adverts"
            element={
              <PrivateRoute>
                <AdvertsList />
              </PrivateRoute>
            }
          />
          <Route
            path="/adverts/create"
            element={
              <PrivateRoute>
                <AdvertForm mode="create" />
              </PrivateRoute>
            }
          />
          <Route
            path="/users"
            element={
              <PrivateRoute>
                <AdminUsersPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/change-password"
            element={
              <PrivateRoute>
                <AdminChangePasswordPage />
              </PrivateRoute>
            }
          />

          <Route
            path="/change-role"
            element={
              <PrivateRoute>
                <AdminChangeRolePage />
              </PrivateRoute>
            }
          />

          <Route
            path="/adverts/:id"
            element={
              <PrivateRoute>
                <AdvertDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/adverts/:id/edit"
            element={
              <PrivateRoute>
                <AdvertForm mode="edit" />
              </PrivateRoute>
            }
          />

          {/* Categories */}
          <Route
            path="/categories"
            element={
              <PrivateRoute>
                <CategoriesList />
              </PrivateRoute>
            }
          />
          <Route
            path="/categories/create"
            element={
              <PrivateRoute>
                <CategoryForm />
              </PrivateRoute>
            }
          />
          <Route
            path="/categories/:id"
            element={
              <PrivateRoute>
                <CategoryDetail />
              </PrivateRoute>
            }
          />
          <Route
            path="/categories/:id/edit"
            element={
              <PrivateRoute>
                <CategoryForm />
              </PrivateRoute>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <PrivateRoute>
                <AdminDashboard />
              </PrivateRoute>
            }
          />

          {/* Feed */}
          <Route
            path="/feed"
            element={
              <PrivateRoute>
                <FeedListPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/feed/:id"
            element={
              <PrivateRoute>
                <FeedDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/feed-admin"
            element={
              <PrivateRoute>
                <FeedAdminPage />
              </PrivateRoute>
            }
          />

          {/* catch-all */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}

export default App;
