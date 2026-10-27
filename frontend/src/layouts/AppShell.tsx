import React from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Vote, 
  LayoutDashboard, 
  ShieldCheck, 
  Users, 
  FileText, 
  Settings as SettingsIcon, 
  Activity,
  Menu,
  X
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Badge } from "../components/ui/badge";

const CURRENT_YEAR = new Date().getFullYear();

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  // Poll backend health for live readiness indication
  const { data: health, isError } = useQuery({
    queryKey: ["backend-health"],
    queryFn: apiClient.getHealth,
    refetchInterval: 15000,
  });

  const navItems = [
    { name: "Overview", to: "/", icon: LayoutDashboard },
    { name: "Elections", to: "/elections", icon: Vote },
    { name: "Institutional Admin", to: "/admin", icon: ShieldCheck },
    { name: "Organizations", to: "/organizations", icon: Users },
    { name: "Audit Records", to: "/audit", icon: FileText },
    { name: "Settings", to: "/settings", icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-border bg-surface/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2 font-bold text-lg text-foreground tracking-tight">
              <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                <Vote className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Pollwise
              </span>
            </Link>
            <Badge variant="outline" className="hidden sm:inline-flex text-xs font-mono">
              Enterprise v0.1.0
            </Badge>
          </div>

          <div className="flex items-center gap-4">
            {/* Live System Health Pill */}
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground border border-border px-2.5 py-1 rounded-full bg-slate-50">
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

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground"
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area with Navigation Sidebar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-8">
        <aside
          className={`md:w-64 flex-shrink-0 ${
            mobileMenuOpen ? "block" : "hidden md:block"
          }`}
        >
          <nav className="space-y-1">
            {navItems.map((item) => {
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
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`
                  }
                >
                  <Icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          <div className="mt-8 p-4 rounded-xl bg-slate-100 border border-border text-xs text-muted-foreground space-y-2">
            <p className="font-semibold text-foreground">Secret Ballot Protection</p>
            <p className="leading-relaxed">
              Voter identity and eligibility records are structurally isolated from the ballot storage box.
            </p>
          </div>
        </aside>

        {/* Dynamic Route Outlet */}
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-surface py-6 text-center text-xs text-muted-foreground mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {CURRENT_YEAR} Pollwise Platform. Institutional Voting Baseline.</p>
          <div className="flex gap-4">
            <span className="hover:underline cursor-pointer">Security Protocol</span>
            <span className="hover:underline cursor-pointer">Privacy & Governance</span>
            <span className="hover:underline cursor-pointer">Operations Runbook</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
