import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Ticket,
  Printer,
  Download,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { PrintableSlipsModal } from "./PrintableSlipsModal";
import type { AccessCodeItem } from "../../types/voter-participation";

interface AccessCodeManagerProps {
  electionId: string;
  electionTitle?: string;
}

export const AccessCodeManager: React.FC<AccessCodeManagerProps> = ({
  electionId,
  electionTitle = "Election",
}) => {
  const queryClient = useQueryClient();
  const [generateCount, setGenerateCount] = useState<number>(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const votingUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/elections/${electionId}/vote`
      : `/elections/${electionId}/vote`;

  // Fetch access codes
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["access-codes", electionId],
    queryFn: () => apiClient.getAccessCodes(electionId),
    enabled: !!electionId,
  });

  const codes = data?.items || [];
  const totalCount = data?.total_count || 0;
  const unusedCount = data?.unused_count || 0;
  const usedCount = data?.used_count || 0;

  // Generate codes mutation
  const generateMutation = useMutation({
    mutationFn: (count: number) => apiClient.generateAccessCodes(electionId, count),
    onSuccess: (resp) => {
      queryClient.setQueryData(["access-codes", electionId], resp);
      setFeedbackMessage({
        type: "success",
        text: `Successfully generated ${generateCount} new alphanumeric voter access codes!`,
      });
      setTimeout(() => setFeedbackMessage(null), 4000);
    },
    onError: (err: any) => {
      setFeedbackMessage({
        type: "error",
        text: err?.message || "Failed to generate access codes.",
      });
    },
  });

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleExportCsv = () => {
    const url = apiClient.exportAccessCodesUrl(electionId);
    window.open(url, "_blank");
  };

  // Filtered list
  const filteredCodes = codes.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.used_by_student_id && c.used_by_student_id.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus =
      statusFilter === "all" ? true : c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Overview Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Generated</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{totalCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Ticket className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Available (Unused Slips)</p>
              <p className="text-2xl font-bold mt-1 text-emerald-600">{unusedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Redeemed / Voted</p>
              <p className="text-2xl font-bold mt-1 text-muted-foreground">{usedCount}</p>
            </div>
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation & Actions Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Ticket className="h-4 w-4 text-primary" />
                Physical Access Codes & Printable Slips
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Generate alphanumeric codes to print out onto physical slips for students. Each code allows entry of a Student ID and permanently expires once their ballot is cast.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPrintModalOpen(true)}
                disabled={unusedCount === 0 && totalCount === 0}
                className="gap-1.5"
              >
                <Printer className="h-4 w-4" />
                Print Slips
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={totalCount === 0}
                className="gap-1.5"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generation form */}
          <div className="flex flex-col sm:flex-row items-center gap-3 p-3.5 bg-muted/30 rounded-lg border border-border/60">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label htmlFor="gen-count" className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                Number of codes to generate:
              </label>
              <Input
                id="gen-count"
                type="number"
                min={1}
                max={5000}
                value={generateCount}
                onChange={(e) => setGenerateCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24 text-center"
              />
            </div>
            <Button
              size="sm"
              onClick={() => generateMutation.mutate(generateCount)}
              disabled={generateMutation.isPending}
              className="w-full sm:w-auto gap-2"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Generate Codes
                </>
              )}
            </Button>
            <span className="text-xs text-muted-foreground italic sm:ml-auto">
              Format: PW-XXXX-XXXX (Alphanumeric, secure, legible)
            </span>
          </div>

          {feedbackMessage && (
            <div
              className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                feedbackMessage.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {feedbackMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              {feedbackMessage.text}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Access Code Table & Search */}
      <Card>
        <CardHeader className="pb-3 border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search code or student ID…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                {(["all", "unused", "used"] as const).map((s) => (
                  <Button
                    key={s}
                    variant={statusFilter === s ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs capitalize px-2.5"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              Loading access codes…
            </div>
          ) : filteredCodes.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">
              {totalCount === 0
                ? "No access codes generated yet. Enter a count above and click 'Generate Codes'."
                : "No access codes match your search criteria."}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground font-medium">
                  <tr>
                    <th className="py-2.5 px-4">#</th>
                    <th className="py-2.5 px-4">Access Code</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4">Student ID (Voter)</th>
                    <th className="py-2.5 px-4">Created</th>
                    <th className="py-2.5 px-4">Used At</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCodes.map((item, idx) => {
                    const isUsed = item.status === "used";
                    return (
                      <tr key={item.id} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-mono font-bold tracking-wider text-foreground">
                          {item.code}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant={isUsed ? "secondary" : "success"} className="text-[11px] capitalize">
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 font-medium">
                          {item.used_by_student_id ? (
                            <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-foreground">
                              {item.used_by_student_id}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-2.5 px-4 text-muted-foreground">
                          {item.used_at ? new Date(item.used_at).toLocaleTimeString() : "—"}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => handleCopy(item.code)}
                            title="Copy code"
                          >
                            {copiedCode === item.code ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Printable Slips Modal */}
      <PrintableSlipsModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        codes={codes}
        electionTitle={electionTitle}
        votingUrl={votingUrl}
      />
    </div>
  );
};
