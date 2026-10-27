import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "../layouts/AppShell";
import { HomePage } from "../pages/HomePage";
import { ElectionsPage } from "../pages/ElectionsPage";
import { AdminDashboardPage } from "../pages/AdminDashboardPage";
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
        path: "admin",
        element: <AdminDashboardPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
