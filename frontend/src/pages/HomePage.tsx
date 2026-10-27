import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Landmark,
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
} from "lucide-react";
import { Button } from "../components/ui/button";

export const HomePage: React.FC = () => {
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  return (
    <div className="space-y-16 lg:space-y-20 pb-16">
      {/* ==================================================================== */}
      {/* 1. HERO SECTION (EXPANDED ARTWORK, FULL-FACE PRESENTATION)            */}
      {/* ==================================================================== */}
      <section className="relative w-full overflow-hidden bg-[#F6FAFE] border-b border-slate-100">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between px-4 sm:px-6 lg:px-8 py-8 lg:py-12 gap-8 lg:gap-6">
          {/* Left Column: Overline, Headline, Copy, Action Buttons, Trust Badges */}
          <div className="w-full lg:w-[44%] xl:w-[42%] space-y-5 z-20 flex-shrink-0">
            {/* Tagline / Overline */}
            <p className="text-[11px] sm:text-xs font-bold text-blue-600 tracking-[0.16em] uppercase">
              INSTITUTIONAL VOTING PLATFORM
            </p>

            {/* Main Headline (Exact 2 lines matching the mockup) */}
            <h1 className="text-3xl sm:text-4xl lg:text-[44px] font-extrabold text-slate-900 tracking-tight leading-[1.1]">
              <span className="block whitespace-nowrap">Secure Elections for</span>
              <span className="block text-blue-600 whitespace-nowrap">Stronger Institutions</span>
            </h1>

            {/* Subtitle / Description */}
            <p className="text-sm sm:text-base text-slate-600 max-w-[480px] leading-relaxed">
              PollWise is a modern, secure, and easy-to-use voting platform built for universities,
              organizations, and institutions. We make elections simple, transparent, and
              trustworthy — from eligibility to results.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <Link to="/elections">
                <button
                  type="button"
                  className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-7 py-3 text-sm sm:text-base font-semibold shadow-md shadow-blue-500/20 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>

              <button
                type="button"
                onClick={() => setVideoModalOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-full border border-blue-200 bg-white hover:bg-blue-50/60 text-blue-600 text-sm sm:text-base font-medium transition-all shadow-xs cursor-pointer"
              >
                <div className="h-4 w-4 rounded-full border border-blue-600 flex items-center justify-center">
                  <Play className="h-2 w-2 fill-blue-600 text-blue-600 ml-0.5" />
                </div>
                <span>Watch Demo</span>
              </button>
            </div>

            {/* Trust Badges Row (3 Checkpoints) */}
            <div className="flex flex-wrap items-center gap-6 pt-2 text-xs sm:text-sm font-medium text-slate-600">
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
                  ✓
                </span>
                <span>Secure & Private</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
                  ✓
                </span>
                <span>Easy to Use</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full bg-[#10B981] text-white flex items-center justify-center text-[10px] font-extrabold flex-shrink-0">
                  ✓
                </span>
                <span>Built for Institutions</span>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Visual Architecture (Enlarged to fill space) */}
          <div className="w-full lg:w-[56%] xl:w-[58%] relative flex items-center justify-end pb-4 lg:pb-0">
            <div className="relative w-full max-w-[720px]">
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
                  top: "54.5%",
                  left: "5.5%",
                  width: "34%",
                  height: "7.5%",
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
                      <Landmark className="h-4 w-4 text-blue-400" />
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
      </div>

      {/* ==================================================================== */}
      {/* 4. MODAL DEMO WALKTHROUGH                                            */}
      {/* ==================================================================== */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Landmark className="h-5 w-5 text-blue-600" />
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
