import React from "react";
import { Vote, Calendar, ArrowRight, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/ui/status-badge";

export const ElectionsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Institutional Elections</h1>
          <p className="text-sm text-muted-foreground">
            View active elections, check eligibility, and cast confidential ballots.
          </p>
        </div>
      </div>

      {/* Informational Notice */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 flex gap-3 text-sm text-slate-700">
        <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Phase 1 Foundation Mode</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Live election catalog and voter entitlement verification will be populated via Phase 3 (Election Management) and Phase 4 (Eligibility & Ballot-Box) API endpoints.
          </p>
        </div>
      </div>

      {/* Representative Institutional Election Card */}
      <div className="grid grid-cols-1 gap-4">
        <Card className="hover:border-slate-300 transition-colors">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status="open" />
                  <span className="text-xs font-medium text-muted-foreground">Student Government Association</span>
                </div>
                <CardTitle className="text-lg">2026 General Student Senate Election</CardTitle>
              </div>
              <Button size="sm" className="gap-1.5" disabled>
                Vote Now
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
            <CardDescription className="pt-2">
              Annual general election selecting representatives for President, Vice President, and Academic Senators across 4 positions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-6 text-xs text-muted-foreground border-t border-border pt-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>Voting closes: Oct 30, 2026 at 17:00 UTC</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Vote className="h-4 w-4 text-slate-400" />
                <span>4 Ballot Positions · 1 Choice Per Position</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
