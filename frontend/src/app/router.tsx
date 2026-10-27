import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { HomePage } from "../pages/HomePage";
import { ElectionsPage } from "../pages/ElectionsPage";
import { ElectionDetailPage } from "../pages/ElectionDetailPage";
import { VotingBoothPage } from "../pages/VotingBoothPage";
import { ElectionResultsPage } from "../pages/ElectionResultsPage";
import { CreateElectionWizardPage } from "../pages/CreateElectionWizardPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export const router = createBrowserRouter([
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
        element: <VotingBoothPage />,
      },
      {
        path: "elections/:id/results",
        element: <ElectionResultsPage />,
      },
      {
        path: "admin",
        element: <AdminDashboardPage />,
      },
      {
        path: "admin/elections/new",
        element: <CreateElectionWizardPage />,
      },
      {
        path: "organizations",
        element: <OrganizationsPage />,
      },
      {
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "register",
        element: <RegisterPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
