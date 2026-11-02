import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Monitor,
  Building2,
  Plus,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Wifi,
  X,
  MapPin,
  Clock,
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import type { VotingCentre, VotingTerminal } from "../types/voter-participation";

export const SupervisorVotingCentresPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: orgs = [] } = useQuery({
    queryKey: ["organizations"],
    queryFn: apiClient.getOrganizations,
  });

  const [selectedOrgId, setSelectedOrgId] = useState<string>("");
  const institutionId = selectedOrgId || orgs[0]?.id || "";

  const { data: centres = [], isLoading: isCentresLoading } = useQuery<VotingCentre[]>({
    queryKey: ["voting-centres", institutionId],
    queryFn: () => apiClient.listVotingCentres(institutionId),
    enabled: !!institutionId,
  });

  const [selectedCentreId, setSelectedCentreId] = useState<string>("");
  const effectiveCentreId = selectedCentreId || centres[0]?.id || "";

  const { data: terminals = [], isLoading: isTerminalsLoading } = useQuery<VotingTerminal[]>({
    queryKey: ["voting-terminals", effectiveCentreId],
    queryFn: () => apiClient.listVotingTerminals(effectiveCentreId),
    enabled: !!effectiveCentreId,
    refetchInterval: 5000, // auto-refresh terminal status every 5 seconds
  });

  // Modals
  const [showAddCentreModal, setShowAddCentreModal] = useState(false);
  const [centreName, setCentreName] = useState("");
  const [centreLocation, setCentreLocation] = useState("");
  const [centreError, setCentreError] = useState<string | null>(null);

  const [showAddTerminalModal, setShowAddTerminalModal] = useState(false);
  const [terminalName, setTerminalName] = useState("");
  const [terminalError, setTerminalError] = useState<string | null>(null);

  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Mutations
  const createCentreMutation = useMutation({
    mutationFn: (payload: { institution_id: string; name: string; location_description?: string }) =>
      apiClient.createVotingCentre(payload),
    onSuccess: (newCentre) => {
      queryClient.invalidateQueries({ queryKey: ["voting-centres", institutionId] });
      setSelectedCentreId(newCentre.id);
      setShowAddCentreModal(false);
      setCentreName("");
      setCentreLocation("");
      setActionNotice(`Created voting centre: ${newCentre.name}`);
      setTimeout(() => setActionNotice(null), 4000);
    },
    onError: (err: unknown) => {
      setCentreError(err instanceof Error ? err.message : "Failed to create voting centre");
    },
  });

  const registerTerminalMutation = useMutation({
    mutationFn: (payload: { centre_id: string; terminal_name: string; authorized_election_id?: string }) =>
      apiClient.registerVotingTerminal(payload.centre_id, payload.terminal_name, payload.authorized_election_id),
    onSuccess: (newTerm) => {
      queryClient.invalidateQueries({ queryKey: ["voting-terminals", effectiveCentreId] });
      setShowAddTerminalModal(false);
      setTerminalName("");
      setActionNotice(`Registered terminal: ${newTerm.terminal_name}`);
      setTimeout(() => setActionNotice(null), 4000);
    },
    onError: (err: unknown) => {
      setTerminalError(err instanceof Error ? err.message : "Failed to register terminal");
    },
  });

  const resetTerminalMutation = useMutation({
    mutationFn: (terminalId: string) => apiClient.supervisorResetTerminal(terminalId),
    onSuccess: (_, terminalId) => {
      queryClient.invalidateQueries({ queryKey: ["voting-terminals", effectiveCentreId] });
      setActionNotice(`Reset signal delivered to terminal ${terminalId}`);
      setTimeout(() => setActionNotice(null), 4000);
    },
  });

  const handleCreateCentreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!centreName.trim()) {
      setCentreError("Please enter a centre name");
      return;
    }
    createCentreMutation.mutate({
      institution_id: institutionId,
      name: centreName.trim(),
      location_description: centreLocation.trim() || undefined,
    });
  };

  const handleRegisterTerminalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalName.trim()) {
      setTerminalError("Please enter a terminal name or PC identifier");
      return;
    }
    registerTerminalMutation.mutate({
      centre_id: effectiveCentreId,
      terminal_name: terminalName.trim(),
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Monitor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Voting Centres & Supervised Terminals
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Supervise on-premise multi-PC computer labs, monitor kiosk heartbeat activity, and trigger remote session resets.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {orgs.length > 1 && (
            <select
              value={institutionId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              className="text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {orgs.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddCentreModal(true)}
            className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
          >
            <Plus className="h-3.5 w-3.5" />
            New Voting Centre
          </Button>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 rounded-lg flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Voting Centres Navigation Tabs */}
      {isCentresLoading ? (
        <Card className="p-10 text-center text-xs text-muted-foreground">
          Loading authorized voting centres...
        </Card>
      ) : centres.length === 0 ? (
        <Card className="p-12 text-center space-y-3">
          <Building2 className="h-9 w-9 text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-semibold text-foreground">No Voting Centres Configured</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Create a supervised voting centre to register PC terminals and operate in kiosk booth mode.
          </p>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowAddCentreModal(true)}
            className="text-xs mt-2"
          >
            Create First Voting Centre
          </Button>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Centre Selector Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {centres.map((c) => {
              const isSelected = c.id === effectiveCentreId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCentreId(c.id)}
                  className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm"
                      : "border-border hover:border-border/80 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-bold text-sm text-foreground">{c.name}</h3>
                    <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">
                      {c.status}
                    </Badge>
                  </div>
                  {c.location_description && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {c.location_description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Selected Centre Terminals Dashboard */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-4 border-b border-border/60">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base font-bold text-foreground">
                    Supervised Terminals & Kiosks
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Real-time status of voting-centre computers and active voter sessions.
                  </CardDescription>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowAddTerminalModal(true)}
                  className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Terminal
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {isTerminalsLoading ? (
                <div className="p-10 text-center text-xs text-muted-foreground">
                  Loading terminals...
                </div>
              ) : terminals.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Monitor className="h-9 w-9 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">No Terminals Registered in this Centre</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Register authorized PCs or kiosks to allow voters to authenticate on-site.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                      <tr>
                        <th className="px-4 py-3">Terminal Name</th>
                        <th className="px-4 py-3">Terminal ID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Last Heartbeat</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {terminals.map((t) => (
                        <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground">
                            {t.terminal_name}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground text-[11px]">
                            {t.id}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant={
                                t.status === "voting"
                                  ? "destructive"
                                  : t.status === "authenticating"
                                  ? "secondary"
                                  : "default"
                              }
                              className="text-[10px] capitalize font-bold"
                            >
                              {t.status}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-[11px] text-muted-foreground">
                            {t.last_heartbeat_at ? (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(t.last_heartbeat_at).toLocaleTimeString()}
                              </span>
                            ) : (
                              "Never"
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link
                                to={`/terminals/${t.id}/booth?token=${t.terminal_token}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 gap-1 text-blue-600 hover:text-blue-700"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  Open Kiosk
                                </Button>
                              </Link>

                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => resetTerminalMutation.mutate(t.id)}
                                disabled={resetTerminalMutation.isPending}
                                className="h-7 text-[11px] px-2 gap-1 font-semibold"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Remote Reset
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add Voting Centre Modal */}
      {showAddCentreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground">Create Voting Centre</h3>
              <button
                type="button"
                onClick={() => setShowAddCentreModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {centreError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{centreError}</span>
              </div>
            )}

            <form onSubmit={handleCreateCentreSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground block">Centre Name *</label>
                <input
                  type="text"
                  value={centreName}
                  onChange={(e) => setCentreName(e.target.value)}
                  placeholder="e.g. Student Union Hall, Main Library Lab"
                  required
                  className="w-full p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground block">
                  Location / Room Description (Optional)
                </label>
                <input
                  type="text"
                  value={centreLocation}
                  onChange={(e) => setCentreLocation(e.target.value)}
                  placeholder="e.g. Building B, Room 204"
                  className="w-full p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddCentreModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createCentreMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {createCentreMutation.isPending ? "Creating..." : "Create Centre"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Terminal Modal */}
      {showAddTerminalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground">Register Voting Terminal</h3>
              <button
                type="button"
                onClick={() => setShowAddTerminalModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {terminalError && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{terminalError}</span>
              </div>
            )}

            <form onSubmit={handleRegisterTerminalSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground block">
                  Terminal Name / PC Identifier *
                </label>
                <input
                  type="text"
                  value={terminalName}
                  onChange={(e) => setTerminalName(e.target.value)}
                  placeholder="e.g. PC 03 or Kiosk Gamma"
                  required
                  className="w-full p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <p className="text-[11px] text-muted-foreground">
                A secure terminal bearer token will be generated to authorize kiosk requests and report heartbeat status.
              </p>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddTerminalModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={registerTerminalMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                >
                  {registerTerminalMutation.isPending ? "Registering..." : "Register Terminal"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
