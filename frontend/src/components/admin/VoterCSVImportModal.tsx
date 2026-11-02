import React, { useState } from "react";
import { UploadCloud, CheckCircle, AlertCircle, FileText, X, AlertTriangle, Users } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { VoterCSVPreviewReport } from "../../types/voter-participation";

interface VoterCSVImportModalProps {
  isOpen: boolean;
  electionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const VoterCSVImportModal: React.FC<VoterCSVImportModalProps> = ({
  isOpen,
  electionId,
  onClose,
  onSuccess,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewReport, setPreviewReport] = useState<VoterCSVPreviewReport | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setGeneralError(null);
    setIsPreviewing(true);

    try {
      const report = await apiClient.previewVoterRollCSV(electionId, file);
      setPreviewReport(report);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to parse CSV preview";
      setGeneralError(msg);
      setPreviewReport(null);
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleCommitImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setGeneralError(null);

    try {
      await apiClient.importVoterRollCSV(electionId, selectedFile);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import voter roll CSV";
      setGeneralError(msg);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <UploadCloud className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">Import Voter Roll CSV</h3>
              <p className="text-xs text-muted-foreground">Upload and validate authorized voter records</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {generalError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-center gap-2 text-xs text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{generalError}</span>
            </div>
          )}

          {/* File Upload Zone */}
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors bg-muted/10">
            <input
              type="file"
              id="voter-csv-file"
              data-testid="voter-csv-file-input"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="voter-csv-file" className="cursor-pointer space-y-2 block">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground" />
              <div className="text-xs font-semibold text-foreground">
                {selectedFile ? selectedFile.name : "Click to select or drop CSV file"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Accepted columns: <code className="bg-muted px-1.5 py-0.5 rounded">identifier</code>, optional <code className="bg-muted px-1.5 py-0.5 rounded">group</code> or <code className="bg-muted px-1.5 py-0.5 rounded">notes</code>
              </p>
            </label>
          </div>

          {isPreviewing && (
            <div className="text-center py-4 text-xs text-muted-foreground animate-pulse">
              Validating CSV records and checking duplicate entries...
            </div>
          )}

          {/* Preview Validation Summary */}
          {previewReport && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Pre-Import Validation Report
              </h4>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-center">
                  <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                    {previewReport.valid_count}
                  </div>
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-500 font-medium">
                    {previewReport.valid_count} Valid Records
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-center">
                  <div className="text-lg font-bold text-amber-700 dark:text-amber-400">
                    {previewReport.duplicate_count}
                  </div>
                  <div className="text-[11px] text-amber-600 dark:text-amber-500 font-medium">
                    {previewReport.duplicate_count} Duplicates
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-center">
                  <div className="text-lg font-bold text-destructive">
                    {previewReport.invalid_count}
                  </div>
                  <div className="text-[11px] text-destructive font-medium">
                    {previewReport.invalid_count} Invalid
                  </div>
                </div>
              </div>

              {/* Errors List */}
              {previewReport.errors && previewReport.errors.length > 0 && (
                <div className="p-3 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Warnings & Errors Detected
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1 text-[11px] text-amber-900 dark:text-amber-200">
                    {previewReport.errors.map((err, idx) => (
                      <div key={idx} className="font-mono">{err}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sample Records */}
              {previewReport.sample_records && previewReport.sample_records.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground">Sample Preview</div>
                  <div className="border border-border rounded-lg overflow-hidden text-xs divide-y divide-border">
                    {previewReport.sample_records.map((rec, i) => (
                      <div key={i} className="p-2.5 flex items-center justify-between">
                        <span className="font-mono text-foreground">{rec.identifier}</span>
                        {rec.voter_group && (
                          <Badge variant="outline" className="text-[10px]">
                            {rec.voter_group}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleCommitImport}
            disabled={!previewReport || previewReport.valid_count === 0 || isImporting}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {isImporting ? "Importing..." : "Confirm and Import"}
          </Button>
        </div>
      </div>
    </div>
  );
};
