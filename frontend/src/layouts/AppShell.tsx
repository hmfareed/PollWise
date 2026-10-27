import React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Landmark,
  Vote,
  LayoutDashboard,
  ShieldCheck,
  Users,
  FileText,
  Settings as SettingsIcon,
  Activity,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";

const CURRENT_YEAR = new Date().getFullYear();

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const isLandingPage = location.pathname === "/";

  // Poll backend health for live readiness indication
  const { data: health, isError } = useQuery({
    queryKey: ["backend-health"],
    queryFn: apiClient.getHealth,
    refetchInterval: 15000,
  });

  const consoleNavItems = [
    { name: "Overview", to: "/", icon: LayoutDashboard },
    { name: "Elections", to: "/elections", icon: Vote },
    { name: "Organizations", to: "/organizations", icon: Users },
    { name: "Institutional Admin", to: "/admin", icon: ShieldCheck },
    { name: "Audit Records", to: "/audit", icon: FileText },
    { name: "Settings", to: "/settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-blue-100 selection:text-blue-900">
      {/* ==================================================================== */}
      {/* TOP NAVBAR                                                           */}
      {/* ==================================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-18 items-center justify-between">
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5 font-bold tracking-tight group">
              <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:bg-blue-700 transition">
                <Landmark className="h-5 w-5" />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-2xl font-extrabold text-blue-950 tracking-tight">
                  Electara
                </span>
                <span className="text-[9px] font-mono font-medium text-slate-400 uppercase tracking-widest hidden sm:inline">
                  Pollwise Platform
                </span>
              </div>
            </Link>

            {/* Desktop Center Links for Landing Page */}
            {isLandingPage && (
              <nav className="hidden md:flex items-center gap-7 text-sm font-medium pt-1">
                <NavLink
                  to="/"
                  className={({ isActive }) =>
                    `transition-colors pb-1 ${
                      isActive
                        ? "text-blue-600 font-semibold border-b-2 border-blue-600"
                        : "text-slate-600 hover:text-slate-900"
                    }`
                  }
                >
                  Home
                </NavLink>
                <NavLink
                  to="/admin"
                  className="text-slate-600 hover:text-slate-900 transition-colors pb-1"
                >
                  Features
                </NavLink>
                <NavLink
                  to="/organizations"
                  className="text-slate-600 hover:text-slate-900 transition-colors pb-1"
                >
                  For Institutions
                </NavLink>
                <NavLink
                  to="/elections"
                  className="text-slate-600 hover:text-slate-900 transition-colors pb-1"
                >
                  Security
                </NavLink>
                <a
                  href="#pricing"
                  className="text-slate-600 hover:text-slate-900 transition-colors pb-1"
                >
                  Pricing
                </a>
                <a
                  href="#about"
                  className="text-slate-600 hover:text-slate-900 transition-colors pb-1"
                >
                  About
                </a>
              </nav>
            )}
          </div>

          {/* Right: Actions & User Session */}
          <div className="flex items-center gap-4">
            {/* Live System Health Pill (Console Mode) */}
            {!isLandingPage && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground border border-border px-2.5 py-1 rounded-full bg-slate-50">
                <Activity className="h-3.5 w-3.5 text-primary" />
                <span>Backend:</span>
                {isError ? (
                  <span className="flex items-center gap-1 text-danger font-medium">
                    <span className="h-2 w-2 rounded-full bg-danger" />
                    Disconnected
                  </span>
                ) : health?.status === "healthy" ? (
                  <span className="flex items-center gap-1 text-success font-medium">
                    <span className="h-2 w-2 rounded-full bg-success" />
                    Operational
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-warning font-medium">
                    <span className="h-2 w-2 rounded-full bg-warning" />
                    Connecting...
                  </span>
                )}
              </div>
            )}

            {/* User Session State */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link to="/elections">
                  <Button variant="outline" size="sm" className="hidden sm:inline-flex rounded-full text-xs font-semibold">
                    Console
                  </Button>
                </Link>
                <div className="hidden sm:flex flex-col items-end text-xs">
                  <span className="font-semibold text-slate-900">{user.display_name}</span>
                  <span className="text-slate-500 font-mono text-[10px]">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="gap-1.5 text-slate-500 hover:text-red-600 rounded-full"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Sign Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login">
                  <button
                    type="button"
                    className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2 transition"
                  >
                    Sign In
                  </button>
                </Link>
                <Link to="/register">
                  <Button
                    size="sm"
                    className="rounded-full bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 text-sm shadow-xs transition"
                  >
                    Get Started
                  </Button>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Menu Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 pt-3 pb-6 space-y-2 shadow-lg animate-fade-in">
            {consoleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        )}
      </header>

      {/* ==================================================================== */}
      {/* MAIN CONTENT AREA                                                    */}
      {/* ==================================================================== */}
      {isLandingPage ? (
        // Full-width Landing Page Container matching the visual design
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full flex-1">
          <Outlet />
        </main>
      ) : (
        // Console Layout with Navigation Sidebar for internal app workflows
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-8">
          <aside
            className={`md:w-64 flex-shrink-0 ${
              mobileMenuOpen ? "block" : "hidden md:block"
            }`}
          >
            <nav className="space-y-1">
              {consoleNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-8 p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-slate-900">Secret Ballot Protection</p>
              <p className="leading-relaxed text-slate-500">
                Voter identity and eligibility records are structurally isolated from the ballot storage box.
              </p>
            </div>
          </aside>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      )}

      {/* ==================================================================== */}
      {/* FOOTER                                                               */}
      {/* ==================================================================== */}
      <footer className="border-t border-slate-100 bg-white py-8 text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-blue-600 flex items-center justify-center text-white">
              <Landmark className="h-3.5 w-3.5" />
            </div>
            <p className="font-medium text-slate-700">
              © {CURRENT_YEAR} Electara — Institutional Voting Platform.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-slate-500">
            <Link to="/audit" className="hover:text-blue-600 transition">
              Security Protocol
            </Link>
            <Link to="/organizations" className="hover:text-blue-600 transition">
              Institutions
            </Link>
            <Link to="/admin" className="hover:text-blue-600 transition">
              Operations Console
            </Link>
            <span className="hover:text-blue-600 transition cursor-pointer">
              Privacy & Governance
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
