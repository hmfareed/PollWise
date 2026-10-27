import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Vote, Calendar, ArrowRight, Plus, Filter } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/ui/status-badge";

export const ElectionsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: elections, isLoading, error } = useQuery({
    queryKey: ["elections", statusFilter],
    queryFn: () => apiClient.getElections(undefined, statusFilter || undefined),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Institutional Elections</h1>
          <p className="text-sm text-muted-foreground">
            Explore open elections, view ballot positions, and verify election schedules.
          </p>
        </div>
        {isAuthenticated && (
          <Link to="/admin/elections/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Election
            </Button>
          </Link>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-muted-foreground mr-1" />
        {[
          { label: "All Elections", value: "" },
          { label: "Open / Active", value: "open" },
          { label: "Scheduled", value: "scheduled" },
          { label: "Drafts", value: "draft" },
          { label: "Closed", value: "closed" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-surface border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="text-center py-12 text-xs text-muted-foreground">
          Loading elections...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-danger">
          Failed to load elections. Please try again.
        </div>
      )}

      {elections && elections.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground space-y-3">
            <Vote className="h-10 w-10 mx-auto text-slate-300" />
            <p className="font-semibold text-foreground">No Elections Found</p>
            <p className="text-xs max-w-sm mx-auto">
              {statusFilter
                ? `No elections found matching the '${statusFilter}' filter.`
                : "There are no institutional elections configured yet. Administrators can create one to begin."}
            </p>
            {isAuthenticated && (
              <Link to="/admin/elections/new">
                <Button variant="secondary" size="sm" className="mt-2">
                  Launch Election Creation Wizard
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {elections && elections.length > 0 && (
        <div className="grid grid-cols-1 gap-4">
          {elections.map((election) => (
            <Card key={election.id} className="hover:border-slate-300 transition-colors">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={election.status} />
                      {election.configuration_hash && (
                        <span className="text-[11px] font-mono text-muted-foreground bg-slate-100 px-2 py-0.5 rounded">
                          Hash: {election.configuration_hash.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    <CardTitle className="text-lg pt-1">
                      <Link to={`/elections/${election.id}`} className="hover:text-primary transition-colors">
                        {election.title}
                      </Link>
                    </CardTitle>
                  </div>
                  <Link to={`/elections/${election.id}`}>
                    <Button size="sm" variant={election.status === "open" ? "default" : "secondary"} className="gap-1.5">
                      {election.status === "open" ? "Vote / View Ballot" : "View Election"}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
                {election.description && (
                  <CardDescription className="pt-2 line-clamp-2">
                    {election.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground border-t border-border pt-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>
                      {election.opens_at
                        ? `Opens: ${new Date(election.opens_at).toLocaleDateString()}`
                        : "Schedule pending"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    <span>
                      {election.closes_at
                        ? `Closes: ${new Date(election.closes_at).toLocaleDateString()}`
                        : "Deadline pending"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Vote className="h-4 w-4 text-slate-400" />
                    <span>Method: {election.voting_method.replace(/_/g, " ")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
