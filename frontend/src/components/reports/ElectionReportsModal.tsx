import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Download,
  X,
  Trophy,
  Users,
  Clock,
  Settings2,
  CheckCircle2,
  FileSpreadsheet,
  FileCode,
  Printer,
  History,
} from "lucide-react";
import { Button } from "../ui/button";
import { Card, CardHeader, CardDescription, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { apiClient } from "../../lib/api-client";
import type { ReportType, ReportFormat } from "../../types/reports";

interface ElectionReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
  electionId: string;
  electionTitle: string;
  isPublished?: boolean;
  onOpenCertificate?: () => void;
}

export const ElectionReportsModal: React.FC<ElectionReportsModalProps> = ({
  isOpen,
  onClose,
  electionId,
  electionTitle,
  isPublished = false,
  onOpenCertificate,
}) => {
  const queryClient = useQueryClient();
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const { data: exportHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ["election-reports-history", electionId],
    queryFn: () => apiClient.getReportExports(electionId),
    enabled: isOpen,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ reportType, format }: { reportType: ReportType; format: ReportFormat }) => {
      // Trigger report generation on server
      await apiClient.generateReport(electionId, {
        report_type: reportType,
        file_format: format,
      });
      // Direct download
      const downloadUrl = apiClient.getReportExportUrl(electionId, reportType, format);
      window.open(downloadUrl, "_blank");
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["election-reports-history", electionId] });
      setDownloadSuccess(`Generated and downloaded ${vars.reportType} (${vars.format.toUpperCase()})`);
      setTimeout(() => setDownloadSuccess(null), 4000);
    },
  });

  if (!isOpen) return null;

  const handleDownload = (reportType: ReportType, format: ReportFormat) => {
    generateMutation.mutate({ reportType, format });
  };

  const reportCards = [
    {
      type: "certified_results" as ReportType,
      title: "Official Certified Results",
      icon: <Trophy className="h-5 w-5 text-amber-500" />,
      description:
        "Certified vote distribution, percentages, winning candidates, canonical configuration hash, and managerial approvals.",
      badge: isPublished ? "Published" : "Draft Tally",
      badgeVariant: isPublished ? "success" : "secondary",
      hasCertificate: true,
    },
    {
      type: "turnout" as ReportType,
      title: "Voter Participation & Turnout",
      icon: <Users className="h-5 w-5 text-blue-500" />,
      description:
        "Aggregated participation counts, registered eligible voter baseline, percentage turnout rate, and channel distribution.",
      badge: "Turnout Analytics",
      badgeVariant: "default",
      hasCertificate: false,
    },
    {
      type: "audit_trail" as ReportType,
      title: "Tamper-Evident Audit Trail",
      icon: <Clock className="h-5 w-5 text-purple-500" />,
      description:
        "Chronological audit log of administrative events, lifecycle state changes, credential issuances, and result publications.",
      badge: "Audit Log",
      badgeVariant: "default",
      hasCertificate: false,
    },
    {
      type: "summary" as ReportType,
      title: "Governance & Ballot Specification",
      icon: <Settings2 className="h-5 w-5 text-emerald-500" />,
      description:
        "Full structural specification of scheduled voting windows, ballot positions, seat limits, and candidate manifestos.",
      badge: "Specification",
      badgeVariant: "default",
      hasCertificate: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-2xl bg-surface border border-border shadow-2xl p-6 sm:p-8 space-y-6 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Election Reports & Certified Exports</h2>
              <p className="text-xs text-muted-foreground truncate max-w-md">{electionTitle}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Success Alert */}
        {downloadSuccess && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs text-emerald-800">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            {downloadSuccess}
          </div>
        )}

        {/* 4 Report Cards Grid */}
        <div className="grid sm:grid-cols-2 gap-4">
          {reportCards.map((card) => (
            <Card key={card.type} className="border border-border/80 hover:border-primary/40 transition-colors flex flex-col justify-between">
              <CardHeader className="p-5 pb-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    {card.icon}
                    {card.title}
                  </div>
                  <Badge variant={card.badgeVariant as any} className="text-[10px]">
                    {card.badge}
                  </Badge>
                </div>
                <CardDescription className="text-xs text-muted-foreground leading-relaxed">
                  {card.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="p-5 pt-0">
                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/50">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleDownload(card.type, "csv")}
                    disabled={generateMutation.isPending}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                    CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5"
                    onClick={() => handleDownload(card.type, "json")}
                    disabled={generateMutation.isPending}
                  >
                    <FileCode className="h-3.5 w-3.5 text-blue-600" />
                    JSON
                  </Button>
                  {card.hasCertificate && onOpenCertificate && (
                    <Button
                      size="sm"
                      className="h-8 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white ml-auto"
                      onClick={() => {
                        onClose();
                        onOpenCertificate();
                      }}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Certificate
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Past Report Exports History */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <History className="h-3.5 w-3.5" />
            Previous Report Export History
          </div>

          <div className="rounded-lg border border-border overflow-hidden bg-muted/20">
            {isHistoryLoading ? (
              <div className="p-4 text-center text-xs text-muted-foreground">Loading export history...</div>
            ) : !exportHistory?.items || exportHistory.items.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No reports previously exported for this election. Click any format above to generate one.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto divide-y divide-border">
                {exportHistory.items.map((item) => (
                  <div key={item.id} className="p-3 flex items-center justify-between text-xs hover:bg-surface transition-colors">
                    <div className="space-y-0.5">
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {item.file_name}
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {item.file_format}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {new Date(item.created_at).toLocaleString()} · SHA-256: {item.checksum?.slice(0, 16)}…
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={() => {
                        const url = apiClient.getReportExportUrl(electionId, item.report_type, item.file_format);
                        window.open(url, "_blank");
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
