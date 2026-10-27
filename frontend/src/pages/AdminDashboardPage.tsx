import React from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Plus, CheckCircle, Database, Vote, Calendar, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatusBadge } from "../components/ui/status-badge";
import { apiClient } from "../lib/api-client";

export const AdminDashboardPage: React.FC = () => {
  const { data: readiness, isLoading: isReadinessLoading } = useQuery({
    queryKey: ["backend-readiness"],
    queryFn: apiClient.getReadiness,
  });

  const { data: elections, isLoading: isElectionsLoading } = useQuery({
    queryKey: ["admin-elections"],
    queryFn: () => apiClient.getElections(),
  });

  const activeCount = elections?.filter((e) => e.status === "open").length || 0;
  const scheduledCount = elections?.filter((e) => e.status === "scheduled").length || 0;
  const draftCount = elections?.filter((e) => e.status === "draft").length || 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Institutional Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            Manage organizations, configure elections, authorize voter registries, and approve results.
          </p>
        </div>
        <Link to="/admin/elections/new">
          <Button className="gap-2 self-start sm:self-auto">
            <Plus className="h-4 w-4" />
            Create Election
          </Button>
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-4 bg-emerald-50/50 border-emerald-200">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Vote className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">
              Active Voting
            </span>
            <p className="text-2xl font-bold text-emerald-950">
              {isElectionsLoading ? "..." : activeCount}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 bg-blue-50/50 border-blue-200">
          <div className="h-10 w-10 rounded-lg bg-blue-100 text-primary flex items-center justify-center">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider">
              Scheduled
            </span>
            <p className="text-2xl font-bold text-blue-950">
              {isElectionsLoading ? "..." : scheduledCount}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-4 bg-slate-50 border-slate-200">
          <div className="h-10 w-10 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Draft Pipeline
            </span>
            <p className="text-2xl font-bold text-slate-900">
              {isElectionsLoading ? "..." : draftCount}
            </p>
          </div>
        </Card>
      </div>

      {/* Recent Elections Management List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Managed Elections</CardTitle>
            <CardDescription className="text-xs">
              Overview of all institutional elections across tenant organizations.
            </CardDescription>
          </div>
          <Link to="/elections">
            <Button variant="ghost" size="sm" className="text-xs">
              View All
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {isElectionsLoading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Loading elections...</p>
          ) : !elections || elections.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-xs text-muted-foreground">No elections found in this institution.</p>
              <Link to="/admin/elections/new">
                <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" />
                  Create First Election
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {elections.slice(0, 5).map((elec) => (
                <div key={elec.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-1">
                    <Link
                      to={`/elections/${elec.id}`}
                      className="font-semibold text-sm text-foreground hover:text-primary transition-colors"
                    >
                      {elec.title}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>Opens: {elec.opens_at ? new Date(elec.opens_at).toLocaleDateString() : "TBD"}</span>
                      <span>·</span>
                      <span>Closes: {elec.closes_at ? new Date(elec.closes_at).toLocaleDateString() : "TBD"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={elec.status} />
                    <Link to={`/elections/${elec.id}`}>
                      <Button size="sm" variant="secondary" className="text-xs">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subsystem Health Matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Isolated Subsystems & Database Boundaries</CardTitle>
            </div>
            {isReadinessLoading ? (
              <Badge variant="outline">Evaluating...</Badge>
            ) : readiness?.ready ? (
              <Badge variant="success">All Subsystems Ready</Badge>
            ) : (
              <Badge variant="danger">Subsystem Offline</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            Live connectivity monitoring across the three isolated logical databases (ADR-001).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {[
              {
                id: "identity_db",
                name: "Identity & Eligibility DB",
                desc: "Accounts, Memberships, Entitlements",
                role: "identity_user",
              },
              {
                id: "election_db",
                name: "Election Management DB",
                desc: "Lifecycle, Candidates, Approvals, Tally",
                role: "election_user",
              },
              {
                id: "ballot_db",
                name: "Ballot-Box DB",
                desc: "Anonymous Ballots & Redemptions",
                role: "ballot_user",
              },
            ].map((db) => {
              const status = readiness?.databases?.[db.id];
              return (
                <div key={db.id} className="rounded-lg border border-border p-4 space-y-2 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-sm text-foreground">{db.name}</p>
                    {status?.connected ? (
                      <CheckCircle className="h-4 w-4 text-success" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{db.desc}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    <span>Role: <code className="text-slate-700">{db.role}</code></span>
                    <span>{status ? `${status.latency_ms}ms` : "Pending DB"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
