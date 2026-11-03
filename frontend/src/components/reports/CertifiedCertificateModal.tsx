import React from "react";
import { Trophy, Printer, Download, X, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { Election, ElectionDetail } from "../../types/election";
import type { ElectionResult } from "../../types/results";
import { apiClient } from "../../lib/api-client";

interface CertifiedCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  election: Election | ElectionDetail;
  results: ElectionResult | null;
  organizationName?: string;
}

export const CertifiedCertificateModal: React.FC<CertifiedCertificateModalProps> = ({
  isOpen,
  onClose,
  election,
  results,
  organizationName = "Institutional Governance",
}) => {
  if (!isOpen) return null;

  const isApproved = results?.approval_status === "approved" || election.status === "published";
  const computedDate = results?.computed_at ? new Date(results.computed_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }) : new Date().toLocaleDateString();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    window.open(apiClient.getResultsExportUrl(election.id, "csv"), "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="relative w-full max-w-3xl rounded-2xl bg-surface border border-border shadow-2xl p-6 sm:p-10 space-y-8 my-8 print:border-none print:shadow-none print:p-0 print:my-0">
        
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-border print:hidden">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-amber-500" />
            Official Results Certificate Preview
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownloadCsv} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5 text-xs bg-primary">
              <Printer className="h-3.5 w-3.5" />
              Print Official Certificate
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* ============================================================== */}
        {/* Printable Official Certificate Body */}
        {/* ============================================================== */}
        <div className="border-4 border-double border-primary/20 rounded-xl p-8 sm:p-12 space-y-8 bg-card/50 print:border-4 print:border-black print:bg-white print:p-8">
          
          {/* Header Seal & Title */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-amber-50 border-2 border-amber-300 text-amber-600 shadow-inner mx-auto mb-1 print:border-black">
              <Trophy className="h-8 w-8" />
            </div>
            <div className="text-xs uppercase tracking-widest font-bold text-muted-foreground print:text-black">
              {organizationName} · Division of Electoral Oversight
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground font-serif print:text-black">
              OFFICIAL CERTIFICATE OF ELECTION RESULTS
            </h1>
            <p className="text-sm text-muted-foreground italic max-w-lg mx-auto print:text-black">
              This document certifies the deterministic final tallies and victorious candidates in accordance with statutory institutional voting governance.
            </p>
          </div>

          {/* Election Identification Banner */}
          <div className="rounded-lg bg-surface border border-border p-4 text-center space-y-1 print:border print:border-black">
            <div className="text-xs text-muted-foreground uppercase tracking-wider font-semibold print:text-black">Election Event</div>
            <div className="text-lg font-bold text-foreground print:text-black">{election.title}</div>
            <div className="text-xs text-muted-foreground font-mono print:text-black">
              Election ID: {election.id}
            </div>
          </div>

          {/* Certified Winners List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground print:text-black">
                Certified Position Results & Winners
              </h2>
              <Badge variant={isApproved ? "success" : "warning"} className="text-xs print:border print:border-black">
                {isApproved ? "OFFICIALLY AUDITED & CERTIFIED" : "UNAUDITED DRAFT RESULTS"}
              </Badge>
            </div>

            <div className="divide-y divide-border border rounded-lg overflow-hidden bg-surface print:border-black print:divide-black">
              {results?.positions && results.positions.length > 0 ? (
                results.positions.map((pos) => {
                  const winners = pos.candidates.filter(
                    (c) => c.candidate_id && pos.winner_ids?.includes(c.candidate_id)
                  );
                  return (
                    <div key={pos.position_id} className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-foreground print:text-black">{pos.title}</span>
                        <span className="text-xs text-muted-foreground print:text-black">
                          {pos.total_votes} total votes cast
                        </span>
                      </div>
                      {winners.length > 0 ? (
                        winners.map((w) => (
                          <div
                            key={w.name}
                            className="flex items-center justify-between bg-amber-50/70 dark:bg-amber-950/20 rounded-md px-3 py-2 border border-amber-200/60 print:border print:border-black print:bg-white"
                          >
                            <span className="font-semibold text-sm flex items-center gap-1.5 text-foreground print:text-black">
                              <CheckCircle2 className="h-4 w-4 text-amber-600 print:text-black" />
                              {w.name}
                              <span className="text-xs text-amber-700 font-bold ml-1 print:text-black">(Elected)</span>
                            </span>
                            <span className="text-xs font-mono font-bold text-foreground tabular-nums print:text-black">
                              {w.votes} votes ({w.percentage.toFixed(2)}%)
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-muted-foreground italic print:text-black">No winners declared or tie pending review</div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="p-6 text-center text-xs text-muted-foreground print:text-black">
                  No tally results recorded for this election.
                </div>
              )}
            </div>
          </div>

          {/* Cryptographic Verification Box */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3 print:border print:border-black print:bg-white">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground print:text-black">
              <ShieldCheck className="h-4 w-4 text-emerald-600 print:text-black" />
              Cryptographic Integrity & Audit Proof
            </div>
            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block print:text-black">Canonical Configuration Hash (SHA-256):</span>
                <span className="font-mono text-[11px] font-semibold break-all text-foreground print:text-black">
                  {results?.configuration_hash || election.configuration_hash || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block print:text-black">Certified Total Ballots Cast:</span>
                <span className="font-semibold text-foreground text-sm print:text-black">
                  {results?.ballot_count ?? 0} valid ballots
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block print:text-black">Tally Algorithm Version:</span>
                <span className="font-mono text-foreground font-semibold print:text-black">v1.0 (Deterministic Single-Choice)</span>
              </div>
              <div>
                <span className="text-muted-foreground block print:text-black">Certification Date:</span>
                <span className="font-semibold text-foreground print:text-black">{computedDate}</span>
              </div>
            </div>
          </div>

          {/* Signatures & Certification Seal */}
          <div className="pt-6 border-t border-dashed border-border grid grid-cols-2 gap-8 text-center text-xs print:border-black">
            <div className="space-y-8">
              <div className="h-10 border-b border-muted-foreground/40 mx-4 print:border-black"></div>
              <div>
                <div className="font-bold text-foreground print:text-black">Electoral Returning Officer</div>
                <div className="text-muted-foreground text-[11px] print:text-black">Institutional Election Authority</div>
              </div>
            </div>
            <div className="space-y-8">
              <div className="h-10 border-b border-muted-foreground/40 mx-4 print:border-black"></div>
              <div>
                <div className="font-bold text-foreground print:text-black">Independent Audit Sign-off</div>
                <div className="text-muted-foreground text-[11px] print:text-black">Tamper-Evident Certification Seal</div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
