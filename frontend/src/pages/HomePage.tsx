import React from "react";
import { Link } from "react-router-dom";
import { Vote, Shield, CheckCircle2, Lock, ArrowRight, Server } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";

export const HomePage: React.FC = () => {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="rounded-2xl border border-border bg-surface p-8 sm:p-12 shadow-sm space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-semibold text-primary">
          <Shield className="h-3.5 w-3.5" />
          <span>Institutional Integrity Architecture</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight leading-tight">
          Secure, Verifiable Institutional Elections
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed">
          Pollwise provides high-assurance voting for universities, student unions, academic departments, and professional associations with strict ballot secrecy.
        </p>

        <div className="flex flex-wrap gap-4 pt-2">
          <Link to="/elections">
            <Button size="lg" className="gap-2">
              Browse Active Elections
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/admin">
            <Button variant="secondary" size="lg">
              Administrator Console
            </Button>
          </Link>
        </div>
      </div>

      {/* Architectural Guarantees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center text-primary mb-2">
              <Lock className="h-5 w-5" />
            </div>
            <CardTitle>Strict Ballot Secrecy</CardTitle>
            <CardDescription>
              Voter identity and eligibility records are structurally decoupled from the anonymous ballot box.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                No voter ID stored in ballot records
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Single-use atomic credential redemption
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Timing & telemetry correlation defenses
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-success mb-2">
              <Vote className="h-5 w-5" />
            </div>
            <CardTitle>Election Lifecycle Control</CardTitle>
            <CardDescription>
              Enforced backend state transitions from draft to published results with zero interim leaks.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Frozen ballot configurations
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Multi-position ballots support
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Post-closing deterministic tallies
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center text-warning mb-2">
              <Server className="h-5 w-5" />
            </div>
            <CardTitle>Separation of Duties</CardTitle>
            <CardDescription>
              Role-based authorization prevents single-actor compromise across administration and tally approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Independent tally approval gate
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Append-only audit event trails
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Read-only auditor access roles
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
