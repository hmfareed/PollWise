import React from "react";
import { Card } from "../ui/card";
import type { ElectionStatusDonutData } from "../../types/dashboard";

export interface ElectionStatusDonutProps {
  statusData?: ElectionStatusDonutData;
  isLoading?: boolean;
}

export const ElectionStatusDonut: React.FC<ElectionStatusDonutProps> = ({
  statusData,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card
        data-testid="donut-skeleton"
        className="p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between animate-pulse"
      >
        <div className="pb-2 border-b border-slate-100">
          <div className="h-4 w-28 bg-slate-100 rounded" />
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <div className="h-32 w-32 rounded-full bg-slate-100" />
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-slate-100 rounded" />
            <div className="h-3 bg-slate-100 rounded" />
            <div className="h-3 bg-slate-100 rounded" />
            <div className="h-3 bg-slate-100 rounded" />
          </div>
        </div>
      </Card>
    );
  }

  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const total = statusData?.total ?? 0;

  const segments = [
    { key: "draft", count: statusData?.draft ?? 0, color: "#94a3b8", label: "Draft" },
    { key: "scheduled", count: statusData?.scheduled ?? 0, color: "#38bdf8", label: "Scheduled" },
    { key: "open", count: statusData?.open ?? 0, color: "#10b981", label: "Open" },
    { key: "closed", count: statusData?.closed ?? 0, color: "#8b5cf6", label: "Closed" },
  ];

  let accumulatedLength = 0;
  const slices = segments.map((seg) => {
    const fraction = total > 0 ? seg.count / total : 0;
    const strokeDash = fraction * circumference;
    const strokeOffset = accumulatedLength;
    accumulatedLength += strokeDash;
    return {
      ...seg,
      strokeDash,
      strokeOffset,
    };
  });

  return (
    <Card className="p-5 bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
      <div className="pb-2 border-b border-slate-100">
        <h3 className="font-bold text-slate-900 text-sm">Election Status</h3>
      </div>
      <div className="flex items-center justify-between gap-4 py-3">
        {/* Donut graphic */}
        <div className="relative h-32 w-32 flex-shrink-0 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background track */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#f1f5f9"
              strokeWidth="14"
            />
            {total > 0 &&
              slices.map((slice) => {
                if (slice.count <= 0) return null;
                return (
                  <circle
                    key={slice.key}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth="14"
                    strokeDasharray={`${slice.strokeDash.toFixed(2)} ${(circumference - slice.strokeDash).toFixed(2)}`}
                    strokeDashoffset={(-slice.strokeOffset).toFixed(2)}
                    className="transition-all duration-500 ease-out"
                  />
                );
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-2xl font-extrabold text-slate-900 leading-none">{total}</span>
            <span className="text-[10px] text-slate-400 font-semibold mt-0.5">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2 text-xs flex-1">
          {segments.map((seg) => (
            <div key={seg.key} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-slate-600 font-medium">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                {seg.label}
              </span>
              <span className="font-bold text-slate-900">{seg.count}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
