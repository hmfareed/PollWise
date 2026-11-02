import React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Landmark,
  Vote,
  LayoutDashboard,
  ShieldCheck,
  Users,
  FileText,
  Settings as SettingsIcon,
  Menu,
  X,
  LogOut,
  Layers,
  UserCheck,
  BarChart3,
  Bell,
  Search,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";

const CURRENT_YEAR = new Date().getFullYear();

export const AppShell: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const { user, isAuthenticated, logout, memberships } = useAuth();
  const location = useLocation();

  // Full-bleed standalone pages with zero sidebar and zero header chrome
  const isAuthRoute = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
  ].some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );

  if (isAuthRoute) {
    return <Outlet />;
  }

  const isLandingPage = location.pathname === "/";

  const isPersonalUser = Boolean(
    isAuthenticated && user && user.account_type !== "institution"
  );
  const isOrgAdmin = Boolean(
    memberships?.some((m) => m.role === "admin" || m.role === "owner")
  );

  const consoleNavItems = isPersonalUser
    ? [
        { name: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
        { name: "Elections", to: "/elections", icon: Vote },
        ...(isOrgAdmin ? [{ name: "Organizations", to: "/organizations", icon: Users }] : []),
        { name: "Settings", to: "/settings", icon: SettingsIcon },
      ]
    : [
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
              <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center p-1.5 shadow-sm group-hover:bg-blue-700 transition">
                <img
                  src="/pollwise-emblem.png"
                  alt="PollWise Emblem"
                  className="h-full w-auto object-contain"
                />
              </div>
              <div className="flex flex-col leading-tight">
                <span className="text-2xl font-extrabold text-blue-950 tracking-tight">
                  PollWise
                </span>
                <span className="text-[9px] font-mono font-medium text-slate-400 uppercase tracking-widest hidden sm:inline">
                  Institutional Voting Platform
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
            {/* Global Search Input on Console Mode (Matching Mockup) */}
            {!isLandingPage && (
              <div className="hidden md:flex items-center relative max-w-sm w-72 lg:w-80">
                <Search className="h-3.5 w-3.5 absolute left-3 text-slate-400" />
                <input
                  type="text"
                  readOnly
                  placeholder="Search elections, candidates, or users...  (Ctrl + K)"
                  className="w-full bg-slate-50/80 border border-slate-200/90 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {/* Notification Bell with Badge (Console Mode) */}
            {!isLandingPage && (
              <div className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer">
                <Bell className="h-4 w-4" />
                <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  3
                </span>
              </div>
            )}

            {/* User Session State */}
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                  <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                    {user.display_name ? user.display_name[0] : "SJ"}
                  </div>
                  <div className="hidden sm:flex flex-col text-left leading-tight">
                    <span className="text-xs font-bold text-slate-900">
                      {user.display_name || (user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : "Dr. Sarah Johnson")}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {isPersonalUser
                        ? "Personal Account · Voter"
                        : "System Administrator · Institutional Admin"}
                    </span>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={logout}
                  className="gap-1.5 text-slate-400 hover:text-red-600 rounded-full h-8 px-2"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
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
        // Full-bleed Landing Page Container matching the visual design
        <main className="w-full flex-1">
          <Outlet />
        </main>
      ) : (
        // Console Layout with Navigation Sidebar for internal app workflows
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full flex-1 flex flex-col md:flex-row gap-6">
          <aside
            className={`md:w-64 flex-shrink-0 bg-[#0B1528] text-slate-300 rounded-2xl p-4 flex flex-col justify-between shadow-xl relative overflow-hidden min-h-[calc(100vh-8rem)] ${
              mobileMenuOpen ? "block" : "hidden md:flex"
            }`}
          >
            <div className="space-y-5 relative z-10">
              {/* Brand in Sidebar matching Mockup */}
              <div className="flex items-center gap-2.5 px-2 pt-1 pb-2 border-b border-white/10">
                <img
                  src="/pollwise-emblem.png"
                  alt="Pollwise"
                  className="h-7 w-auto object-contain drop-shadow"
                />
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-extrabold text-white tracking-tight">Pollwise</span>
                </div>
              </div>

              <div className="px-2">
                <span className="text-[10px] font-bold text-sky-400/90 uppercase tracking-widest">
                  {isPersonalUser ? "Personal Account" : "Institutional Admin"}
                </span>
              </div>

              {/* Navigation Items matching user role */}
              <nav className="space-y-1 text-sm font-medium">
                {isPersonalUser ? (
                  <>
                    <NavLink
                      to="/dashboard"
                      end
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                    </NavLink>

                    <NavLink
                      to="/elections"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <Vote className="h-4 w-4" />
                      <span>Elections</span>
                    </NavLink>

                    {isOrgAdmin && (
                      <NavLink
                        to="/organizations"
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                            isActive
                              ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                              : "text-slate-400 hover:text-white hover:bg-white/5"
                          }`
                        }
                      >
                        <Landmark className="h-4 w-4" />
                        <span>Organizations</span>
                      </NavLink>
                    )}

                    <NavLink
                      to="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <SettingsIcon className="h-4 w-4" />
                      <span>Settings</span>
                    </NavLink>
                  </>
                ) : (
                  <>
                    <NavLink
                      to="/admin"
                      end
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      <span>Dashboard</span>
                      <span className="sr-only">Overview</span>
                    </NavLink>

                    <NavLink
                      to="/elections"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <Vote className="h-4 w-4" />
                      <span>Elections</span>
                    </NavLink>

                    <NavLink
                      to="/admin/positions"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <Layers className="h-4 w-4" />
                      <span>Positions</span>
                    </NavLink>

                    <NavLink
                      to="/admin/candidates"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <UserCheck className="h-4 w-4" />
                      <span>Candidates</span>
                    </NavLink>

                    <NavLink
                      to="/admin/voters"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <ShieldCheck className="h-4 w-4" />
                      <span>Voters & Eligibility</span>
                    </NavLink>

                    <NavLink
                      to="/organizations"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <Landmark className="h-4 w-4" />
                      <span>Organizations</span>
                    </NavLink>

                    <NavLink
                      to="/admin/reports"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <BarChart3 className="h-4 w-4" />
                      <span>Reports</span>
                    </NavLink>

                    <NavLink
                      to="/admin/audit"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <FileText className="h-4 w-4" />
                      <span>Audit Logs</span>
                    </NavLink>

                    <NavLink
                      to="/admin/team"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <Users className="h-4 w-4" />
                      <span>Team & Permissions</span>
                    </NavLink>

                    <NavLink
                      to="/settings"
                      onClick={() => setMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                          isActive
                            ? "bg-[#1D68F2] text-white font-semibold shadow-sm"
                            : "text-slate-400 hover:text-white hover:bg-white/5"
                        }`
                      }
                    >
                      <SettingsIcon className="h-4 w-4" />
                      <span>Settings</span>
                    </NavLink>
                  </>
                )}
              </nav>
            </div>

            {/* Bottom Institution Card */}
            {!isPersonalUser ? (
              <div className="relative z-10 mt-auto pt-6">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Your institution</p>
                      <p className="font-bold text-white text-xs truncate max-w-[130px]">
                        University of Excellence
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/organizations"
                    className="inline-flex items-center text-[10px] text-blue-400 hover:text-blue-300 font-medium pt-1"
                  >
                    View Profile →
                  </Link>
                </div>
              </div>
            ) : memberships.length > 0 ? (
              <div className="relative z-10 mt-auto pt-6">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400">Your institution</p>
                      <p className="font-bold text-white text-xs truncate max-w-[130px]">
                        {memberships[0].organization_name}
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/settings"
                    className="inline-flex items-center text-[10px] text-blue-400 hover:text-blue-300 font-medium pt-1"
                  >
                    Manage Memberships →
                  </Link>
                </div>
              </div>
            ) : null}

            {/* Ambient bottom wave glow graphic */}
            <div className="absolute -bottom-8 -left-8 -right-8 h-32 opacity-25 pointer-events-none bg-gradient-to-t from-blue-600 via-sky-500 to-transparent blur-xl" />
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
            <div className="h-6 w-6 rounded-md bg-blue-600 flex items-center justify-center p-1 text-white shadow-xs">
              <img
                src="/pollwise-emblem.png"
                alt="PollWise Emblem"
                className="h-full w-auto object-contain"
              />
            </div>
            <p className="font-medium text-slate-700">
              © {CURRENT_YEAR} PollWise — Institutional Voting Platform.
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
