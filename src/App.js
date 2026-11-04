// src/App.js
import React from "react";
import "./App.css";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import { AuthProvider, useAuth } from "./contexts/AuthProvider";
import Sidebar from "./components/Sidebar";
import PrivateRoute from "./PrivateRoute";

// your existing components
import Login from "./components/Login";
import Home from "./components/Home";
import RecipeList from "./components/RecipeList";
import RecipeThemesDashboard from "./components/Recipe_themes_dashboard";
import RecipeCreate from "./components/RecipeCreate";
import RecipeDetail from "./components/RecipeDetail";
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
import ImageLibrary from "./pages/Imagelibrary";
import CreatorsPage from "./pages/CreatorsPage";
import CreatorDetailPage from "./pages/CreatorDetailPage";
import AppFeedbackPage from "./pages/AppFeedbackPage";
import WarehousesPage from "./pages/WarehousesPage";
import WarehouseDetailPage from "./pages/WarehouseDetailPage";
import FinancePage from "./pages/FinancePage";
import CampaignsPage from "./pages/CampaignsPage";
import MarketCatalogPage from "./pages/MarketCatalogPage";
import CouponsPage from "./pages/CouponsPage";

// small helper for "/" route to preserve your existing logic
function LoginOrRedirect() {
  const { token } = useAuth();
  return token ? <Navigate to="/home" replace /> : <Login />;
}

function AppRoutes() {
  const { token } = useAuth();

  return (
    <>
      <Sidebar />

      <div className={token ? "app-layout" : ""}>
        {/* Push content area beside the sidebar when authenticated */}
        <main className={token ? "app-content" : ""}>
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

            <Route
              path="/imagelib"
              element={
                <PrivateRoute>
                  <ImageLibrary />
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

            <Route
              path="/users"
              element={
                <PrivateRoute>
                  <AdminUsersPage />
                </PrivateRoute>
              }
            />

            <Route
              path="/creators"
              element={
                <PrivateRoute>
                  <CreatorsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/creators/:id"
              element={
                <PrivateRoute>
                  <CreatorDetailPage />
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

            {/* App Feedback */}
            <Route
              path="/feedback"
              element={
                <PrivateRoute>
                  <AppFeedbackPage />
                </PrivateRoute>
              }
            />

            {/* Warehouses */}
            <Route
              path="/warehouses"
              element={
                <PrivateRoute>
                  <WarehousesPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/warehouses/:id"
              element={
                <PrivateRoute>
                  <WarehouseDetailPage />
                </PrivateRoute>
              }
            />

            {/* Finance & Withdrawals + Order Disputes */}
            <Route
              path="/finance"
              element={
                <PrivateRoute>
                  <FinancePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/withdrawals"
              element={
                <PrivateRoute>
                  <FinancePage />
                </PrivateRoute>
              }
            />
            <Route
              path="/disputes"
              element={
                <PrivateRoute>
                  <FinancePage defaultTab="disputes" />
                </PrivateRoute>
              }
            />

            {/* Promotional & Creator Campaigns */}
            <Route
              path="/campaigns"
              element={
                <PrivateRoute>
                  <CampaignsPage />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin-dashboard/campaigns"
              element={
                <PrivateRoute>
                  <CampaignsPage />
                </PrivateRoute>
              }
            />

            {/* Market Catalog: Ingredients Catalog, Categories & Meal Packs */}
            <Route
              path="/market-catalog"
              element={
                <PrivateRoute>
                  <MarketCatalogPage defaultTab="catalog" />
                </PrivateRoute>
              }
            />
            <Route
              path="/ingredients-catalog"
              element={
                <PrivateRoute>
                  <MarketCatalogPage defaultTab="catalog" />
                </PrivateRoute>
              }
            />
            <Route
              path="/meal-packs"
              element={
                <PrivateRoute>
                  <MarketCatalogPage defaultTab="meal-packs" />
                </PrivateRoute>
              }
            />

            {/* Promotional Coupons */}
            <Route
              path="/coupons"
              element={
                <PrivateRoute>
                  <CouponsPage />
                </PrivateRoute>
              }
            />

            {/* catch-all */}
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
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

