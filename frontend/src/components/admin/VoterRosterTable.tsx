import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, UserPlus, Trash2, Filter, UploadCloud, Users, CheckCircle2, AlertCircle, X } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { VoterRecord } from "../../types/voter-participation";

interface VoterRosterTableProps {
  electionId: string;
  identifierLabel?: string;
  onOpenImportModal?: () => void;
}

export const VoterRosterTable: React.FC<VoterRosterTableProps> = ({
  electionId,
  identifierLabel = "Identifier",
  onOpenImportModal,
}) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Add Single Voter Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newIdentifier, setNewIdentifier] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [newStatus, setNewStatus] = useState("eligible");
  const [addError, setAddError] = useState<string | null>(null);

  const { data: voters = [], isLoading } = useQuery({
    queryKey: ["voters", electionId, page, searchQuery, statusFilter],
    queryFn: () =>
      apiClient.listVoterRoll(
        electionId,
        page,
        pageSize,
        searchQuery || undefined,
        statusFilter === "all" ? undefined : statusFilter
      ),
  });

  const addVoterMutation = useMutation({
    mutationFn: (payload: { identifier: string; voter_group?: string; eligibility_status?: string }) =>
      apiClient.addSingleVoter(electionId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voters", electionId] });
      setShowAddModal(false);
      setNewIdentifier("");
      setNewGroup("");
      setAddError(null);
    },
    onError: (err: unknown) => {
      setAddError(err instanceof Error ? err.message : "Failed to add voter");
    },
  });

  const deleteVoterMutation = useMutation({
    mutationFn: (voterId: string) => apiClient.deleteVoter(electionId, voterId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voters", electionId] });
    },
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdentifier.trim()) {
      setAddError(`Please enter a valid ${identifierLabel}`);
      return;
    }
    addVoterMutation.mutate({
      identifier: newIdentifier.trim(),
      voter_group: newGroup.trim() || undefined,
      eligibility_status: newStatus,
    });
  };

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Approved Election Voter Roll
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Independent voter roll authorized to participate in this election.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2.5">
            {onOpenImportModal && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenImportModal}
                className="gap-1.5 text-xs h-9"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Import CSV
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddModal(true)}
              className="gap-1.5 text-xs h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Add Voter
            </Button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search by ${identifierLabel} or group...`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Eligibility</option>
              <option value="eligible">Eligible Only</option>
              <option value="ineligible">Ineligible</option>
            </select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-10 text-center text-xs text-muted-foreground">
            Loading election voter roll...
          </div>
        ) : voters.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Users className="h-9 w-9 text-muted-foreground/40 mx-auto" />
            <p className="text-sm font-semibold text-foreground">No voters registered on this roll</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Add individual {identifierLabel} records or import a CSV roll to authorize eligible voters.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">{identifierLabel}</th>
                  <th className="px-4 py-3">Group / Unit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Enrolled</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {voters.map((v) => (
                  <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-mono font-medium text-foreground">
                      {v.normalized_identifier}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {v.voter_group || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={v.eligibility_status === "eligible" ? "default" : "destructive"}
                        className="text-[10px] uppercase font-bold"
                      >
                        {v.eligibility_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground capitalize">
                      {v.source.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label="Delete voter"
                        onClick={() => deleteVoterMutation.mutate(v.id)}
                        disabled={deleteVoterMutation.isPending}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Single Voter Modal Dialog */}
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="font-bold text-sm text-foreground">Add Individual Voter</h3>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {addError && (
                <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-xs text-destructive flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground block">
                    {identifierLabel} *
                  </label>
                  <input
                    type="text"
                    value={newIdentifier}
                    onChange={(e) => setNewIdentifier(e.target.value)}
                    placeholder={`Enter ${identifierLabel}`}
                    required
                    className="w-full p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground block">
                    Voter Group / Department (Optional)
                  </label>
                  <input
                    type="text"
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    placeholder="e.g. Computer Science, Faculty of Arts"
                    className="w-full p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground block">
                    Eligibility Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="eligible">Eligible</option>
                    <option value="ineligible">Ineligible</option>
                  </select>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addVoterMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    {addVoterMutation.isPending ? "Saving..." : "Save Voter"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
