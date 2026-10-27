import React from "react";
import { ShieldAlert, Plus, CheckCircle, Database } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { apiClient } from "../lib/api-client";

export const AdminDashboardPage: React.FC = () => {
  const { data: readiness, isLoading } = useQuery({
    queryKey: ["backend-readiness"],
    queryFn: apiClient.getReadiness,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Institutional Admin Console</h1>
          <p className="text-sm text-muted-foreground">
            Manage organizations, configure elections, authorize voter registries, and approve results.
          </p>
        </div>
        <Button className="gap-2 self-start sm:self-auto" disabled>
          <Plus className="h-4 w-4" />
          Create Election (Phase 3)
        </Button>
      </div>

      {/* Subsystem Health Matrix */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Isolated Subsystems & Database Boundaries</CardTitle>
            </div>
            {isLoading ? (
              <Badge variant="outline">Evaluating...</Badge>
            ) : readiness?.ready ? (
              <Badge variant="success">All Subsystems Ready</Badge>
            ) : (
              <Badge variant="danger">Subsystem Offline</Badge>
            )}
          </div>
          <CardDescription>
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
