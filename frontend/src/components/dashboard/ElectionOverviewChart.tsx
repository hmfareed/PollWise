import React from "react";
import { BarChart2, ChevronDown } from "lucide-react";
import { Card } from "../ui/card";
import type { DashboardPeriod, ElectionOverviewChartData } from "../../types/dashboard";

export interface ElectionOverviewChartProps {
  overview?: ElectionOverviewChartData;
  period: DashboardPeriod | string;
  onPeriodChange: (p: DashboardPeriod) => void;
  isLoading?: boolean;
}

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "last_30_days", label: "Last 30 Days" },
  { value: "last_3_months", label: "Last 3 Months" },
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "last_12_months", label: "Last 12 Months" },
];

function generateSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let path = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return path;
}

export const ElectionOverviewChart: React.FC<ElectionOverviewChartProps> = ({
  overview,
  period,
  onPeriodChange,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card
        data-testid="chart-skeleton"
        className="p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between animate-pulse"
      >
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="h-4 w-32 bg-slate-100 rounded" />
          <div className="h-6 w-24 bg-slate-100 rounded" />
        </div>
        <div className="pt-4 h-52 w-full flex items-center justify-center">
          <div className="w-full h-36 bg-slate-100 rounded" />
        </div>
      </Card>
    );
  }

  const points = overview?.points || [];
  const hasNoData =
    points.length === 0 ||
    points.every(
      (p) => (p.created || 0) === 0 && (p.closed || 0) === 0 && (p.published || 0) === 0
    );

  const rawMax = Math.max(
    0,
    ...points.flatMap((p) => [p.created || 0, p.closed || 0, p.published || 0])
  );
  const maxY = Math.max(rawMax, 5);

  const chartLeft = 40;
  const chartRight = 480;
  const chartWidth = chartRight - chartLeft;
  const topY = 20;
  const bottomY = 140;
  const chartHeight = bottomY - topY;

  const getX = (idx: number) => {
    if (points.length <= 1) return (chartLeft + chartRight) / 2;
    return Math.round(chartLeft + (idx / (points.length - 1)) * chartWidth);
  };

  const getY = (val: number) => {
    const clamped = Math.max(0, Math.min(val, maxY));
    return Math.round(bottomY - (clamped / maxY) * chartHeight);
  };

  const createdCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.created || 0) }));
  const closedCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.closed || 0) }));
  const publishedCoords = points.map((p, i) => ({ x: getX(i), y: getY(p.published || 0) }));

  const gridSteps = [
    { y: 20, val: Math.round(maxY) },
    { y: 60, val: Math.round(maxY * 0.66) },
    { y: 100, val: Math.round(maxY * 0.33) },
    { y: 140, val: 0 },
  ];

  return (
    <Card className="p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
      {/* Header Container Matching Mockup */}
      <div className="space-y-1.5 pb-2">
        {/* Row 1: Title & Icon on the left, Dropdown Period Selector on the right */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <BarChart2 className="h-5 w-5 text-slate-900 flex-shrink-0" />
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base tracking-tight whitespace-nowrap">
              Election Overview
            </h3>
          </div>
          <div className="relative flex-shrink-0">
            <select
              value={period}
              onChange={(e) => onPeriodChange(e.target.value as DashboardPeriod)}
              className="text-xs font-medium border border-slate-200/90 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 shadow-xs cursor-pointer hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500 pr-7 appearance-none"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Row 2: Legend Aligned to the Right */}
        <div className="flex items-center justify-end gap-3.5 sm:gap-4 text-xs pt-0.5">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-blue-600" /> Created
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Closed
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span className="h-2 w-2 rounded-full bg-purple-500" /> Published
          </span>
        </div>
      </div>

      {hasNoData ? (
        <div className="pt-4 h-52 w-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 rounded-xl bg-slate-50/50 my-2">
          <div className="h-10 w-10 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
            <BarChart2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No election activity yet</p>
          <p className="text-xs text-slate-500 max-w-sm mt-1">
            Create an election to start seeing your institution's election trends.
          </p>
        </div>
      ) : (
        <div className="pt-4 h-52 w-full">
          <svg className="w-full h-full overflow-visible" viewBox="0 0 500 160">
            {gridSteps.map((step, idx) => (
              <React.Fragment key={idx}>
                <line x1="30" y1={step.y} x2="490" y2={step.y} stroke="#f1f5f9" strokeWidth="1" />
                <text x="24" y={step.y + 3} fontSize="9" fill="#94a3b8" textAnchor="end">
                  {step.val}
                </text>
              </React.Fragment>
            ))}

            {/* Created Series (Blue) */}
            <path
              d={generateSmoothPath(createdCoords)}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {createdCoords.map((pt, i) => (
              <circle
                key={`created-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#2563eb"
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}

            {/* Closed Series (Emerald) */}
            <path
              d={generateSmoothPath(closedCoords)}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {closedCoords.map((pt, i) => (
              <circle
                key={`closed-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#10b981"
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}

            {/* Published Series (Purple) */}
            <path
              d={generateSmoothPath(publishedCoords)}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {publishedCoords.map((pt, i) => (
              <circle
                key={`published-${i}`}
                cx={pt.x}
                cy={pt.y}
                r="3.5"
                fill="#8b5cf6"
                stroke="#fff"
                strokeWidth="1.5"
              />
            ))}

            {/* X-axis Month/Period Labels */}
            {points.map((p, idx) => (
              <text
                key={p.label || idx}
                x={getX(idx)}
                y="156"
                fontSize="9"
                fill="#94a3b8"
                textAnchor="middle"
              >
                {p.label}
              </text>
            ))}
          </svg>
        </div>
      )}
    </Card>
  );
};
