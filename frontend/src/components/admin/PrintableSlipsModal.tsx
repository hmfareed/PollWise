import React, { useRef } from "react";
import { Printer, X, Copy, Check, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "../ui/button";
import type { AccessCodeItem } from "../../types/voter-participation";

interface PrintableSlipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  codes: AccessCodeItem[];
  electionTitle: string;
  votingUrl: string;
}

export const PrintableSlipsModal: React.FC<PrintableSlipsModalProps> = ({
  isOpen,
  onClose,
  codes,
  electionTitle,
  votingUrl,
}) => {
  const [copiedCode, setCopiedCode] = React.useState<string | null>(null);
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Filter to unused codes for printing, or show all if requested
  const printableCodes = codes.filter((c) => c.status === "unused");
  const displayCodes = printableCodes.length > 0 ? printableCodes : codes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      {/* Container */}
      <div className="relative w-full max-w-5xl bg-card border border-border rounded-xl shadow-2xl my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header (Hidden on print) */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 print:hidden">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              Printable Voter Slips
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Print and cut these slips along the dotted lines to distribute to eligible voters.
              Showing {displayCodes.length} available slip(s).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={handlePrint} className="gap-2">
              <Printer className="h-4 w-4" />
              Print Slips Now
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Slips Content Area */}
        <div className="p-6 overflow-y-auto flex-1 bg-muted/20" ref={printAreaRef}>
          {displayCodes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No unused access codes found. Please generate new codes first.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
              {displayCodes.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-card border-2 border-dashed border-border rounded-lg p-4 flex flex-col justify-between shadow-sm page-break-inside-avoid print:border-black print:text-black"
                  style={{ minHeight: "170px" }}
                >
                  {/* Slip Header */}
                  <div className="flex items-start justify-between border-b border-border/60 pb-2 print:border-black">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary print:text-black">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        PollWise Official Voter Slip
                      </div>
                      <h4 className="font-semibold text-sm line-clamp-1 mt-0.5">
                        {electionTitle || "Institutional Election"}
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground print:border print:border-black">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Access Code Highlight */}
                  <div className="my-3 text-center bg-muted/40 py-2.5 px-3 rounded-md border border-border/40 print:bg-transparent print:border print:border-black">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground block mb-0.5 print:text-black">
                      Your Secret Voting Access Code
                    </span>
                    <div className="flex items-center justify-center gap-2">
                      <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-primary print:text-black select-all">
                        {item.code}
                      </span>
                      <button
                        onClick={() => handleCopy(item.code)}
                        className="print:hidden p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                        title="Copy code"
                      >
                        {copiedCode === item.code ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Instructions */}
                  <div className="text-[11px] space-y-1 text-muted-foreground print:text-black">
                    <div className="flex items-center gap-1 font-medium">
                      <span>1. Visit voting booth:</span>
                      <span className="font-mono text-foreground font-semibold underline print:text-black truncate">
                        {votingUrl}
                      </span>
                    </div>
                    <p>2. Enter this access code, then enter your <strong>Student ID</strong>.</p>
                    <p className="text-[10px] italic text-amber-600 dark:text-amber-400 print:text-black font-medium">
                      * Single-use only: Both this code and your Student ID expire permanently upon ballot submission.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Print Styles injected for crisp paper output */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .page-break-inside-avoid {
              page-break-inside: avoid;
              break-inside: avoid;
            }
            div[class*="overflow-y-auto"] {
              overflow: visible !important;
              max-height: none !important;
            }
            div[class*="fixed"] {
              position: static !important;
              padding: 0 !important;
              margin: 0 !important;
              background: white !important;
            }
            div[class*="max-w-5xl"] {
              max-width: 100% !important;
              border: none !important;
              box-shadow: none !important;
            }
            div[class*="max-w-5xl"] * {
              visibility: visible;
            }
          }
        ` }} />
      </div>
    </div>
  );
};
