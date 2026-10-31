import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Shield,
  ShieldCheck,
  CheckCircle2,
  Users,
  Zap,
  Globe,
  ArrowRight,
  Play,
  Search,
  Bell,
  Vote,
  FileText,
  Settings,
  X,
  Lock,
  Database,
  Key,
  ChevronDown,
  Building,
  GraduationCap,
  Award,
} from "lucide-react";
import { Button } from "../components/ui/button";

export const HomePage: React.FC = () => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="space-y-16 lg:space-y-20 pb-16">
      {/* ==================================================================== */}
      {/* 1. HERO SECTION (EXPANDED ARTWORK, FULL-VIEWPORT HERO PRESENTATION)   */}
      {/* ==================================================================== */}
      <section className="relative w-full overflow-hidden bg-[#F6FAFE] border-b border-slate-100 min-h-[calc(100vh-4.5rem)] flex flex-col justify-center">
        <div className="max-w-7xl xl:max-w-[1440px] 2xl:max-w-[1560px] mx-auto w-full flex flex-col lg:flex-row items-center justify-between px-4 sm:px-6 lg:px-10 xl:px-12 py-10 sm:py-14 lg:py-16 xl:py-20 gap-10 lg:gap-8">
          {/* Left Column: Overline, Headline, Copy, Action Buttons, Trust Badges */}
          <div className="w-full lg:w-[45%] xl:w-[43%] space-y-6 sm:space-y-7 z-20 flex-shrink-0">
            {/* Tagline / Overline */}
            <p className="text-xs sm:text-sm font-bold text-blue-600 tracking-[0.18em] uppercase">
              INSTITUTIONAL VOTING PLATFORM
            </p>

            {/* Main Headline (Exact 2 lines matching the mockup) */}
            <h1 className="text-3xl sm:text-5xl lg:text-[46px] xl:text-[54px] 2xl:text-[60px] font-extrabold text-slate-900 tracking-tight leading-[1.08]">
              <span className="block whitespace-nowrap">Secure Elections for</span>
              <span className="block text-blue-600 whitespace-nowrap">Stronger Institutions</span>
            </h1>

            {/* Subtitle / Description */}
            <p className="text-base sm:text-lg lg:text-[18px] text-slate-600 max-w-[520px] leading-relaxed">
              PollWise is a modern, secure, and easy-to-use voting platform built for universities,
              organizations, and institutions. We make elections simple, transparent, and
              trustworthy — from eligibility to results.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link to="/elections">
                <button
                  type="button"
                  className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 text-base sm:text-lg font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center gap-2.5 cursor-pointer"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="h-5 w-5" />
                </button>
              </Link>

              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-full border border-blue-200 bg-white hover:bg-blue-50/60 text-blue-600 text-base sm:text-lg font-medium transition-all shadow-xs cursor-pointer"
              >
                <div className="h-5 w-5 rounded-full border border-blue-600 flex items-center justify-center">
                  <Play className="h-2.5 w-2.5 fill-blue-600 text-blue-600 ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Trust Badges Row (3 Checkpoints) */}
            <div className="flex flex-wrap items-center gap-6 sm:gap-8 pt-2 text-xs sm:text-sm lg:text-base font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] sm:text-xs font-extrabold flex-shrink-0">
                  ✓
                </span>
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] sm:text-xs font-extrabold flex-shrink-0">
                  ✓
                </span>
                <span>Easy to Use</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] sm:text-xs font-extrabold flex-shrink-0">
                  ✓
                </span>
                <span>Built for Institutions</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Visual Architecture (Enlarged to fill space) */}
          <div className="w-full lg:w-[55%] xl:w-[57%] relative flex items-center justify-end pb-4 lg:pb-0">
            <div className="relative w-full max-w-[760px] lg:max-w-[840px] xl:max-w-[900px] 2xl:max-w-[960px]">
              <img
                src="/hero-illustration.png"
                alt="PollWise Institutional Voting Platform Architecture"
                className="w-full h-auto object-contain select-none block"
              />

              {/* Interactive Hit Target over the "Start Voting ->" button on the floating card */}
              <Link
                to="/elections"
                title="Start Voting"
                role="button"
                aria-label="Start Voting"
                className="absolute z-10 rounded-lg cursor-pointer transition hover:ring-2 hover:ring-blue-400 hover:ring-offset-2 flex items-center justify-center"
                style={{
                  top: "56%",
                  left: "8.6%",
                  width: "33.9%",
                  height: "7.3%",
                }}
              >
                <span className="sr-only">Start Voting</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16 lg:space-y-20">

      {/* ==================================================================== */}
      {/* 2. FIVE KEY VALUE PILLARS STRIP                                      */}
      {/* ==================================================================== */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-10 rounded-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Card 1 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Secure by Design</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Your data and ballots are protected with industry best practices.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-3">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">For All Institutions</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Universities, schools, associations, and organizations.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Transparent Process</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              From eligibility to results, every step is auditable.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <Zap className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Built for Efficiency</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Save time with streamlined workflows and automation.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-cyan-100 text-cyan-600 flex items-center justify-center mb-3">
              <Globe className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">Global Ready</h4>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              Accessible, reliable, and scalable for institutions worldwide.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 3. "WHY POLLWISE" / "MORE THAN JUST A VOTE"                          */}
      {/* ==================================================================== */}
      <section className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Why PollWise Copy */}
          <div className="lg:col-span-5 space-y-6">
            <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
              WHY POLLWISE
            </span>

            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
              More than just a vote
            </h2>

            <p className="text-base text-slate-600 leading-relaxed">
              PollWise combines security, simplicity, and transparency to help your institution run
              elections with confidence.
            </p>

            <ul className="space-y-3.5 pt-2">
              <li className="flex items-start gap-3 text-sm text-slate-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-xs mt-0.5">
                  ✓
                </span>
                <span>Manage multiple elections and positions</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-xs mt-0.5">
                  ✓
                </span>
                <span>Control voter eligibility and access</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-xs mt-0.5">
                  ✓
                </span>
                <span>Ensure ballot secrecy and prevent duplicate voting</span>
              </li>
              <li className="flex items-start gap-3 text-sm text-slate-700">
                <span className="h-5 w-5 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center text-xs mt-0.5">
                  ✓
                </span>
                <span>Get accurate results with built-in audit trails</span>
              </li>
            </ul>

            <div className="pt-2">
              <Link to="/admin">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-semibold shadow-sm flex items-center gap-2">
                  <span>Explore All Features</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Column: High-Fidelity Admin Dashboard Preview Mockup */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl shadow-2xl border border-slate-200 bg-white overflow-hidden text-xs">
              <div className="flex flex-col md:flex-row min-h-[440px]">
                {/* Mini Sidebar */}
                <div className="w-full md:w-44 bg-slate-900 text-slate-300 p-3 flex flex-col justify-between border-r border-slate-800">
                  <div className="space-y-4">
                    {/* Brand */}
                    <div className="flex items-center gap-1.5 px-2 py-1 text-white font-bold text-sm">
                      <img src="/pollwise-emblem.png" alt="PollWise" className="h-4 w-auto object-contain" />
                      <span>PollWise</span>
                    </div>

                    {/* Nav Items */}
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-600/30 text-blue-400 font-semibold border-l-2 border-blue-500">
                        <Vote className="h-3.5 w-3.5" />
                        <span>Dashboard</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <Vote className="h-3.5 w-3.5" />
                        <span>Elections</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <Users className="h-3.5 w-3.5" />
                        <span>Positions</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <Users className="h-3.5 w-3.5" />
                        <span>Candidates</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>Voters & Eligibility</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <Users className="h-3.5 w-3.5" />
                        <span>Organizations</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <FileText className="h-3.5 w-3.5" />
                        <span>Reports</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <Shield className="h-3.5 w-3.5" />
                        <span>Audit Logs</span>
                      </div>
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-800/60 transition">
                        <Settings className="h-3.5 w-3.5" />
                        <span>Settings</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Main Dashboard Area */}
                <div className="flex-1 bg-slate-50/70 p-4 sm:p-5 flex flex-col justify-between space-y-4">
                  {/* Top Bar */}
                  <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200/80">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="h-3.5 w-3.5 absolute left-2.5 top-2 text-slate-400" />
                      <input
                        type="text"
                        readOnly
                        placeholder="Search elections, candidates..."
                        className="w-full bg-white border border-slate-200 rounded-md pl-8 pr-3 py-1.5 text-[11px] text-slate-600 focus:outline-hidden"
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-500">
                        <Bell className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          SJ
                        </div>
                        <div className="hidden sm:block text-left text-[11px] leading-tight">
                          <p className="font-semibold text-slate-900">Sarah Johnson</p>
                          <p className="text-[10px] text-slate-400">System Administrator</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Welcome Message */}
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Welcome back, Admin</h3>
                    <p className="text-[11px] text-slate-500">
                      Here's what's happening with your elections today.
                    </p>
                  </div>

                  {/* 4 Stat Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between text-blue-600 mb-1">
                        <Vote className="h-4 w-4" />
                        <span className="text-[10px] text-emerald-600 font-semibold">+2</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 leading-none">5</p>
                      <p className="text-[10px] text-slate-400 mt-1">Total Elections</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between text-emerald-600 mb-1">
                        <Users className="h-4 w-4" />
                        <span className="text-[10px] text-emerald-600 font-semibold">↑12%</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 leading-none">2,843</p>
                      <p className="text-[10px] text-slate-400 mt-1">Eligible Voters</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between text-purple-600 mb-1">
                        <Users className="h-4 w-4" />
                        <span className="text-[10px] text-slate-400 font-medium">6 pos</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 leading-none">28</p>
                      <p className="text-[10px] text-slate-400 mt-1">Candidates</p>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
                      <div className="flex items-center justify-between text-teal-600 mb-1">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-[10px] text-teal-600 font-medium">100%</span>
                      </div>
                      <p className="text-lg font-bold text-slate-900 leading-none">2</p>
                      <p className="text-[10px] text-slate-400 mt-1">Completed</p>
                    </div>
                  </div>

                  {/* Bottom Panels: Donut Chart & Upcoming Deadlines */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
                    {/* Donut Chart: Election Status Overview */}
                    <div className="sm:col-span-6 bg-white p-3 rounded-lg border border-slate-200/80">
                      <p className="font-semibold text-slate-900 text-[11px] mb-2">
                        Election Status Overview
                      </p>
                      <div className="flex items-center gap-3">
                        {/* Donut graphic */}
                        <div className="relative h-16 w-16 flex items-center justify-center">
                          <svg viewBox="0 0 36 36" className="h-16 w-16 transform -rotate-90">
                            {/* Background Circle */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#e2e8f0"
                              strokeWidth="3.8"
                            />
                            {/* Open: 40% (Blue) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#2563eb"
                              strokeWidth="3.8"
                              strokeDasharray="40, 100"
                            />
                            {/* Upcoming: 40% (Teal/Emerald) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="3.8"
                              strokeDasharray="40, 100"
                              strokeDashoffset="-40"
                            />
                            {/* Completed: 20% (Amber) */}
                            <path
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="3.8"
                              strokeDasharray="20, 100"
                              strokeDashoffset="-80"
                            />
                          </svg>
                          <div className="absolute text-center leading-none">
                            <span className="text-xs font-bold text-slate-900">5</span>
                          </div>
                        </div>

                        {/* Legend */}
                        <div className="text-[10px] space-y-1 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-blue-600" />
                            <span>Open (2 · 40%)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            <span>Upcoming (2 · 40%)</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-500" />
                            <span>Completed (1 · 20%)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upcoming Deadlines */}
                    <div className="sm:col-span-6 bg-white p-3 rounded-lg border border-slate-200/80 space-y-2">
                      <p className="font-semibold text-slate-900 text-[11px]">
                        Upcoming Deadlines
                      </p>
                      <div className="space-y-1.5 text-[10px]">
                        <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                          <div className="truncate pr-2">
                            <p className="font-medium text-slate-900 truncate">
                              Student Union Leadership
                            </p>
                            <p className="text-[9px] text-blue-600">Closes in 2 days</p>
                          </div>
                          <Link
                            to="/elections"
                            className="text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            View
                          </Link>
                        </div>

                        <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-100">
                          <div className="truncate pr-2">
                            <p className="font-medium text-slate-900 truncate">
                              Faculty Senate Election
                            </p>
                            <p className="text-[9px] text-emerald-600">Opens in 3 days</p>
                          </div>
                          <Link
                            to="/elections"
                            className="text-blue-600 hover:underline font-semibold cursor-pointer"
                          >
                            View
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 4. HOW POLLWISE WORKS (Doc 27 Section 2.3)                           */}
      {/* ==================================================================== */}
      <section id="how-it-works" className="space-y-10 py-6 border-t border-slate-100">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
            WORKFLOW
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            How PollWise Works
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            A seamless three-phase lifecycle designed to guarantee institutional integrity at every step.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative space-y-4">
            <div className="h-12 w-12 rounded-xl bg-blue-50 text-blue-600 font-extrabold text-lg flex items-center justify-center">
              01
            </div>
            <h3 className="text-lg font-bold text-slate-900">Setup & Eligibility</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Onboard your institution, configure faculties and departments, and verify eligible voters through roster import or approved email domain verification.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative space-y-4">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 font-extrabold text-lg flex items-center justify-center">
              02
            </div>
            <h3 className="text-lg font-bold text-slate-900">Configure & Freeze</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Define multi-position ballots, approve candidate slates, and compute a SHA-256 configuration fingerprint to lock election parameters before voting begins.
            </p>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs relative space-y-4">
            <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 font-extrabold text-lg flex items-center justify-center">
              03
            </div>
            <h3 className="text-lg font-bold text-slate-900">Secret Vote & Certified Tally</h3>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Voters cast ballots through an anonymous credential redemption channel. Tallies are calculated deterministically and published with verifiable audit trails.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 5. BUILT FOR INSTITUTIONS (Doc 27 Section 2.3)                        */}
      {/* ==================================================================== */}
      <section id="institutions" className="space-y-10 py-6 border-t border-slate-100">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
            ORGANIZATIONAL REACH
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Built for Institutions
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Tailored governance structures for academic, professional, and corporate bodies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Universities & Colleges</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Senate elections, faculty dean representation, departmental board seats, and staff governance councils.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Student Unions & SRCs</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              High-volume executive officer elections, campus referendums, and hall of residence representative ballots.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Professional Associations</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Medical councils, bar associations, engineering boards, and certified licensing body executive appointments.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
              <Building className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-base">Nonprofit & Corporate</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              Shareholder resolutions, board member elections, cooperative societies, and employee representative ballots.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 6. SECURITY ARCHITECTURE & BALLOT SECRECY (Doc 27 Section 2.3)        */}
      {/* ==================================================================== */}
      <section id="security" className="space-y-10 py-6 border-t border-slate-100">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
            BALLOT INTEGRITY
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Security & Ballot Secrecy
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Real architectural controls that protect voter privacy and prevent tampering.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4">
            <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center text-white">
              <Database className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-base text-white">Isolated Data Stores</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Voter identities, election metadata, and cast ballots reside in physically isolated database instances to ensure choices cannot be mapped back to voters.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white">
              <Key className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-base text-white">Anonymous Ingestion</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              The ballot-box submission endpoint strictly enforces omission of authentication cookies. Ballots are accepted via single-use blind token redemption.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900 text-white space-y-4">
            <div className="h-10 w-10 rounded-xl bg-purple-600 flex items-center justify-center text-white">
              <Lock className="h-5 w-5" />
            </div>
            <h4 className="font-bold text-base text-white">SHA-256 Configuration Locks</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Every election computes a deterministic SHA-256 fingerprint upon launch. Any post-launch modification to candidates or rules invalidates the certified tally.
            </p>
          </div>
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 7. FREQUENTLY ASKED QUESTIONS (Doc 27 Section 2.3)                   */}
      {/* ==================================================================== */}
      <section id="faq" className="space-y-10 py-6 border-t border-slate-100">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <span className="text-xs font-bold text-blue-600 tracking-wider uppercase">
            QUESTIONS & ANSWERS
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            Clear, transparent answers about privacy, administration, and results verification.
          </p>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {[
            {
              q: "How does PollWise guarantee ballot secrecy?",
              a: "PollWise uses architectural separation between voter authentication and ballot casting. Voter identity is stored in an isolated identity database, completely separated from the ballot-box database. When a vote is cast, authentication cookies are omitted, ensuring the system cannot associate a specific ballot choice with an individual voter.",
            },
            {
              q: "Can an administrator see who I voted for?",
              a: "No. Administrators only see aggregate participation status (whether an eligible member has participated or not) for turnout tracking. The administrative console has no mechanism to view or link individual selections.",
            },
            {
              q: "How are vote results tallied and verified?",
              a: "Once voting closes, the platform runs a deterministic tallying algorithm against the sealed ballot box. Results are hashed against the initial election configuration fingerprint to certify that no rules or candidate slates were modified during voting.",
            },
            {
              q: "Can voters submit more than one ballot?",
              a: "No. Eligibility records track voting credential redemption. Once a ballot is cast, the single-use credential is marked redeemed in the eligibility ledger, preventing duplicate submissions.",
            },
            {
              q: "What roles are available for managing institutional elections?",
              a: "PollWise supports 8 specialized roles: Organization Administrator, Election Manager, Candidate Reviewer, Voter Eligibility Manager, Tally Officer, Results Approver, Electoral Auditor, and Member.",
            },
          ].map((item, idx) => (
            <div
              key={idx}
              className="border border-slate-200 rounded-xl bg-white overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-slate-900 text-sm hover:bg-slate-50 transition-colors"
              >
                <span>{item.q}</span>
                <ChevronDown
                  className={`h-4 w-4 text-slate-500 transition-transform flex-shrink-0 ${
                    openFaq === idx ? "transform rotate-180" : ""
                  }`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ==================================================================== */}
      {/* 8. FINAL CALL TO ACTION (Doc 27 Section 2.3)                          */}
      {/* ==================================================================== */}
      <section className="rounded-3xl bg-blue-600 text-white p-8 sm:p-12 text-center space-y-6 shadow-xl shadow-blue-500/10">
        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
          Ready to Modernize Your Institutional Elections?
        </h2>
        <p className="max-w-2xl mx-auto text-blue-100 text-sm sm:text-base leading-relaxed">
          Join universities, associations, and governance bodies conducting verifiable, private, and transparent elections with PollWise.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link to="/register">
            <button
              type="button"
              className="rounded-full bg-white text-blue-600 hover:bg-blue-50 px-8 py-3.5 text-base font-semibold shadow-md transition-all cursor-pointer"
            >
              Register Your Institution
            </button>
          </Link>
          <Link to="/elections">
            <button
              type="button"
              className="rounded-full border border-white/40 hover:bg-white/10 text-white px-8 py-3.5 text-base font-medium transition-all cursor-pointer"
            >
              Browse Active Elections
            </button>
          </Link>
        </div>
      </section>
      </div>

      {/* ==================================================================== */}
      {/* 4. MODAL DEMO WALKTHROUGH                                            */}
      {/* ==================================================================== */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <img src="/pollwise-emblem.png" alt="PollWise" className="h-5 w-auto object-contain" />
                <h3 className="font-bold text-slate-900 text-lg">
                  PollWise Platform Walkthrough
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center text-white p-6 text-center space-y-3">
              <div className="h-14 w-14 rounded-full bg-blue-600 flex items-center justify-center text-white shadow-lg cursor-pointer hover:scale-105 transition-transform">
                <Play className="h-6 w-6 fill-current ml-1" />
              </div>
              <p className="font-semibold text-sm">Interactive Voting Lifecycle Preview</p>
              <p className="text-xs text-slate-400 max-w-md">
                Observe the complete journey: eligibility verification, single-use credential
                issuance, anonymous ballot-box submission, and deterministic tallying.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setVideoModalOpen(false)}>
                Close
              </Button>
              <Link to="/elections" onClick={() => setVideoModalOpen(false)}>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Enter Live Platform
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
