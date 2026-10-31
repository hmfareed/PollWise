import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { HomePage } from "../pages/HomePage";
import { ElectionsPage } from "../pages/ElectionsPage";
import { ElectionDetailPage } from "../pages/ElectionDetailPage";
import { VotingBoothPage } from "../pages/VotingBoothPage";
import { ElectionResultsPage } from "../pages/ElectionResultsPage";
import { CreateElectionWizardPage } from "../pages/CreateElectionWizardPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { InstitutionOnboardingPage } from "../pages/InstitutionOnboardingPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { SettingsPage } from "../pages/SettingsPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProtectedRoute } from "../components/ProtectedRoute";

export const router = createBrowserRouter([
  // Full-page standalone Authentication routes (no AppShell, no sidebar, no navbar)
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/reset-password",
    element: <ResetPasswordPage />,
  },
  {
    path: "/verify-email",
    element: <VerifyEmailPage />,
  },

  // Main application shell
  {
    path: "/",
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "elections",
        element: <ElectionsPage />,
      },
      {
        path: "elections/:id",
        element: <ElectionDetailPage />,
      },
      {
        path: "elections/:id/vote",
        element: (
          <ProtectedRoute>
            <VotingBoothPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "elections/:id/results",
        element: <ElectionResultsPage />,
      },
      {
        path: "admin",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/positions",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage initialTab="positions" />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/candidates",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage initialTab="candidates" />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/voters",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage initialTab="voters" />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/reports",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage initialTab="reports" />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/audit",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage initialTab="audit" />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/team",
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboardPage initialTab="team" />
          </ProtectedRoute>
        ),
      },
      {
        path: "audit",
        element: (
          <ProtectedRoute>
            <AdminDashboardPage initialTab="audit" />
          </ProtectedRoute>
        ),
      },
      {
        path: "onboarding",
        element: (
          <ProtectedRoute requireAdmin>
            <InstitutionOnboardingPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "admin/elections/new",
        element: (
          <ProtectedRoute requireAdmin>
            <CreateElectionWizardPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "organizations",
        element: <OrganizationsPage />,
      },
      {
        path: "settings",
        element: (
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
