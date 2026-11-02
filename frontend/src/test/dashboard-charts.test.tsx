import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Vote, Users, Trophy } from "lucide-react";
import { KPICard } from "../components/dashboard/KPICard";
import { ElectionOverviewChart } from "../components/dashboard/ElectionOverviewChart";
import { ElectionStatusDonut } from "../components/dashboard/ElectionStatusDonut";
import type { ElectionOverviewChartData, ElectionStatusDonutData } from "../types/dashboard";

describe("KPICard", () => {
  it("renders zero value and title correctly", () => {
    render(<KPICard title="Total Elections" value={0} icon={Vote} />);
    expect(screen.getByText("Total Elections")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("formats large numbers with locale formatting", () => {
    render(<KPICard title="Eligible Voters" value={8450} icon={Users} />);
    expect(screen.getByText("Eligible Voters")).toBeInTheDocument();
    expect(screen.getByText("8,450")).toBeInTheDocument();
  });

  it("renders positive trend badge when changePct is positive", () => {
    render(<KPICard title="Eligible Voters" value={8450} changePct={12} icon={Users} />);
    expect(screen.getByText(/↑\s*12%/)).toBeInTheDocument();
  });

  it("renders negative trend badge when changePct is negative", () => {
    render(<KPICard title="Eligible Voters" value={8450} changePct={-5} icon={Users} />);
    expect(screen.getByText(/↓\s*5%/)).toBeInTheDocument();
  });

  it("renders neutral badge when changePct is 0", () => {
    render(<KPICard title="Active Elections" value={3} changePct={0} icon={Vote} />);
    expect(screen.getByText(/0%/)).toBeInTheDocument();
  });

  it("OMITS trend badge completely when changePct is null or undefined (Strict Zero Fake Data Rule)", () => {
    const { rerender } = render(<KPICard title="Total Elections" value={10} changePct={null} icon={Vote} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↑/)).not.toBeInTheDocument();
    expect(screen.queryByText(/↓/)).not.toBeInTheDocument();

    rerender(<KPICard title="Total Elections" value={10} icon={Vote} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<KPICard title="Active Elections" value={3} icon={Vote} subtitle="Active Voting" />);
    expect(screen.getByText("Active Voting")).toBeInTheDocument();
  });

  it("renders dynamic SVG sparkline path when points are provided", () => {
    const { container } = render(
      <KPICard title="Registered Candidates" value={86} icon={Trophy} sparklinePoints={[10, 20, 15, 30, 45]} />
    );
    const svgPath = container.querySelector("svg path");
    expect(svgPath).toBeInTheDocument();
    const d = svgPath?.getAttribute("d");
    expect(d).toBeTruthy();
    expect(d).not.toBe("M 0 35 L 100 35"); // Not a flat line
  });

  it("renders flat baseline when sparklinePoints are empty or all 0", () => {
    const { container } = render(
      <KPICard title="Registered Candidates" value={0} icon={Trophy} sparklinePoints={[0, 0, 0, 0]} />
    );
    const svgPath = container.querySelector("svg path");
    expect(svgPath).toBeInTheDocument();
  });

  it("renders skeleton state when isLoading is true", () => {
    render(<KPICard title="Total Elections" value={10} icon={Vote} isLoading={true} />);
    expect(screen.getByTestId("kpi-skeleton")).toBeInTheDocument();
  });
});

describe("ElectionOverviewChart", () => {
  const emptyOverview: ElectionOverviewChartData = {
    period: "last_12_months",
    points: [
      { label: "Jan", timestamp: "2026-01-01", created: 0, closed: 0, published: 0 },
      { label: "Feb", timestamp: "2026-02-01", created: 0, closed: 0, published: 0 },
    ],
  };

  const populatedOverview: ElectionOverviewChartData = {
    period: "last_12_months",
    points: [
      { label: "Jan", timestamp: "2026-01-01", created: 2, closed: 1, published: 0 },
      { label: "Feb", timestamp: "2026-02-01", created: 5, closed: 3, published: 2 },
      { label: "Mar", timestamp: "2026-03-01", created: 8, closed: 6, published: 5 },
    ],
  };

  it("renders clean empty state banner when points are empty or all zeroes", () => {
    const onPeriodChange = vi.fn();
    const { rerender } = render(
      <ElectionOverviewChart
        overview={emptyOverview}
        period="last_12_months"
        onPeriodChange={onPeriodChange}
      />
    );

    expect(screen.getByText("No election activity yet")).toBeInTheDocument();
    expect(
      screen.getByText("Create an election to start seeing your institution's election trends.")
    ).toBeInTheDocument();

    // Also when points array is empty
    rerender(
      <ElectionOverviewChart
        overview={{ period: "last_12_months", points: [] }}
        period="last_12_months"
        onPeriodChange={onPeriodChange}
      />
    );
    expect(screen.getByText("No election activity yet")).toBeInTheDocument();
  });

  it("renders dynamic SVG chart and series lines when data is present", () => {
    const onPeriodChange = vi.fn();
    const { container } = render(
      <ElectionOverviewChart
        overview={populatedOverview}
        period="last_12_months"
        onPeriodChange={onPeriodChange}
      />
    );

    expect(screen.queryByText("No election activity yet")).not.toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();

    // Check SVG viewBox
    const chartSvg = container.querySelector("svg[viewBox='0 0 500 160']");
    expect(chartSvg).toBeInTheDocument();

    // Check labels Jan, Feb, Mar
    expect(screen.getByText("Jan")).toBeInTheDocument();
    expect(screen.getByText("Feb")).toBeInTheDocument();
    expect(screen.getByText("Mar")).toBeInTheDocument();

    // Verify paths exist for the series
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onPeriodChange when user selects another period", () => {
    const onPeriodChange = vi.fn();
    render(
      <ElectionOverviewChart
        overview={populatedOverview}
        period="last_12_months"
        onPeriodChange={onPeriodChange}
      />
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "last_30_days" } });
    expect(onPeriodChange).toHaveBeenCalledWith("last_30_days");
  });

  it("renders skeleton loader when isLoading is true", () => {
    render(
      <ElectionOverviewChart
        period="last_12_months"
        onPeriodChange={vi.fn()}
        isLoading={true}
      />
    );
    expect(screen.getByTestId("chart-skeleton")).toBeInTheDocument();
  });
});

describe("ElectionStatusDonut", () => {
  const emptyStatusData: ElectionStatusDonutData = {
    total: 0,
    draft: 0,
    scheduled: 0,
    open: 0,
    closed: 0,
    published: 0,
    canceled: 0,
  };

  const populatedStatusData: ElectionStatusDonutData = {
    total: 10,
    draft: 2,
    scheduled: 1,
    open: 4,
    closed: 3,
    published: 0,
    canceled: 0,
  };

  it("renders 0 Total in center and 0 for all statuses in legend when total is 0", () => {
    const { container } = render(<ElectionStatusDonut statusData={emptyStatusData} />);

    // Total in center and legend items all show 0
    const zeroes = screen.getAllByText("0");
    // Center count + 4 legend items = 5 zeroes
    expect(zeroes.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByText("Total")).toBeInTheDocument();

    // Legend items
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();

    // Verify no colored segment slices are rendered (only background track)
    const circles = container.querySelectorAll("svg circle");
    // Only 1 background track circle
    expect(circles.length).toBe(1);
  });

  it("renders donut segments and real legend counts when total > 0", () => {
    const { container } = render(<ElectionStatusDonut statusData={populatedStatusData} />);

    // Total count in center
    expect(screen.getByText("10")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();

    // Legend counts
    expect(screen.getByText("2")).toBeInTheDocument(); // Draft
    expect(screen.getByText("1")).toBeInTheDocument(); // Scheduled
    expect(screen.getByText("4")).toBeInTheDocument(); // Open
    expect(screen.getByText("3")).toBeInTheDocument(); // Closed

    // Verify colored segment circles exist
    const circles = container.querySelectorAll("svg circle");
    // 1 background circle + 4 slice circles = 5 circles
    expect(circles.length).toBe(5);

    // Check strokeDasharray on one of the segment circles
    const segmentCircles = Array.from(circles).slice(1);
    segmentCircles.forEach((circle) => {
      expect(circle.getAttribute("stroke-dasharray")).toBeTruthy();
      expect(circle.getAttribute("stroke-dashoffset")).toBeTruthy();
    });
  });

  it("renders skeleton loader when isLoading is true", () => {
    render(<ElectionStatusDonut isLoading={true} />);
    expect(screen.getByTestId("donut-skeleton")).toBeInTheDocument();
  });
});
