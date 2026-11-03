import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient } from "../lib/api-client";

describe("apiClient Reports & Export Methods", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("generateReport calls /elections/:id/reports/generate with payload", async () => {
    const mockResponse = {
      data: {
        report: {
          id: "rep-123",
          election_id: "elec-123",
          report_type: "certified_results",
          file_format: "csv",
          file_name: "test.csv",
          checksum: "hash123",
          generated_by: "user-123",
          created_at: "2026-11-03T20:00:00Z",
        },
        download_url: "/api/v1/elections/elec-123/reports/export?report_type=certified_results&format=csv",
        content_preview: "# POLLWISE",
      },
      error: null,
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.generateReport("elec-123", {
      report_type: "certified_results",
      file_format: "csv",
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/elections/elec-123/reports/generate"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ report_type: "certified_results", file_format: "csv" }),
      })
    );
    expect(result.report.report_type).toBe("certified_results");
  });

  it("getReportExports calls /elections/:id/reports", async () => {
    const mockResponse = {
      data: {
        items: [
          {
            id: "rep-123",
            election_id: "elec-123",
            report_type: "turnout",
            file_format: "csv",
            file_name: "turnout.csv",
            checksum: "hash456",
            generated_by: "user-123",
            created_at: "2026-11-03T20:00:00Z",
          },
        ],
        total_count: 1,
      },
      error: null,
    };

    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await apiClient.getReportExports("elec-123");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/elections/elec-123/reports"),
      expect.anything()
    );
    expect(result.total_count).toBe(1);
    expect(result.items[0].report_type).toBe("turnout");
  });

  it("getReportExportUrl constructs valid download URL", () => {
    const url = apiClient.getReportExportUrl("elec-123", "audit_trail", "csv");
    expect(url).toContain("/api/v1/elections/elec-123/reports/export?report_type=audit_trail&format=csv");
  });
});
