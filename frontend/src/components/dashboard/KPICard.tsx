import React from "react";
import type { LucideIcon } from "lucide-react";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

export interface KPICardProps {
  title: string;
  value: number;
  changePct?: number | null;
  icon: LucideIcon;
  colorScheme?: "blue" | "emerald" | "purple" | "amber";
  sparklinePoints?: number[];
  isLoading?: boolean;
  subtitle?: string;
}

const SCHEMES = {
  blue: {
    icon: "bg-blue-50 text-blue-600",
    stroke: "#3b82f6",
    svg: "text-blue-500",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-600",
    stroke: "#10b981",
    svg: "text-emerald-500",
  },
  purple: {
    icon: "bg-purple-50 text-purple-600",
    stroke: "#8b5cf6",
    svg: "text-purple-500",
  },
  amber: {
    icon: "bg-amber-50 text-amber-600",
    stroke: "#f59e0b",
    svg: "text-amber-500",
  },
};

function generateSparklinePath(points?: number[]): { d: string; isFlat: boolean } {
  if (!points || points.length === 0) {
    return { d: "M 0 35 L 100 35", isFlat: true };
  }
  const max = Math.max(...points);
  const min = Math.min(...points);
  if (max === 0 && min === 0) {
    return { d: "M 0 35 L 100 35", isFlat: true };
  }
  const range = max - min || 1;
  const pathParts: string[] = [];
  points.forEach((pt, idx) => {
    const x = points.length === 1 ? 50 : Math.round((idx / (points.length - 1)) * 100);
    const y = Math.round(35 - ((pt - min) / range) * 30);
    if (idx === 0) {
      pathParts.push(`M ${x} ${y}`);
    } else {
      pathParts.push(`L ${x} ${y}`);
    }
  });
  return { d: pathParts.join(" "), isFlat: false };
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  changePct,
  icon: Icon,
  colorScheme = "blue",
  sparklinePoints,
  isLoading = false,
  subtitle,
}) => {
  if (isLoading) {
    return (
      <Card
        data-testid="kpi-skeleton"
        className="p-5 bg-white border border-slate-200/80 shadow-xs animate-pulse"
      >
        <div className="flex items-start justify-between">
          <div className="h-11 w-11 rounded-xl bg-slate-100" />
          <div className="w-24 h-10 bg-slate-100 rounded" />
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-3 w-20 bg-slate-100 rounded" />
          <div className="h-7 w-28 bg-slate-100 rounded" />
        </div>
      </Card>
    );
  }

  const scheme = SCHEMES[colorScheme] || SCHEMES.blue;
  const { d, isFlat } = generateSparklinePath(sparklinePoints);

  const hasChange = changePct !== null && changePct !== undefined;
  let trendText = "";
  let trendColor = "text-slate-500";

  if (hasChange) {
    if (changePct > 0) {
      trendText = `↑ ${changePct}%`;
      trendColor = "text-emerald-600";
    } else if (changePct < 0) {
      trendText = `↓ ${Math.abs(changePct)}%`;
      trendColor = "text-rose-600";
    } else {
      trendText = "0%";
      trendColor = "text-slate-500";
    }
  }

  return (
    <Card className="p-5 bg-white border border-slate-200/80 shadow-xs hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", scheme.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <svg
          className={cn("w-24 h-10 overflow-visible", isFlat ? "text-slate-300" : scheme.svg)}
          viewBox="0 0 100 40"
        >
          <path
            d={d}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={isFlat ? "3 3" : undefined}
          />
        </svg>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">{title}</span>
          {subtitle && (
            <span className="text-[10px] text-muted-foreground font-semibold">{subtitle}</span>
          )}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-2xl font-extrabold text-slate-900">{value.toLocaleString()}</span>
          {hasChange && (
            <span className={cn("text-xs font-semibold flex items-center", trendColor)}>
              {trendText}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
};
