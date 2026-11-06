import React from "react";
import { Activity, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import type { TurnoutVelocityPoint } from "../../types/election";

export interface TurnoutVelocityChartProps {
  velocity: TurnoutVelocityPoint[];
  isLoading?: boolean;
}

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

export const TurnoutVelocityChart: React.FC<TurnoutVelocityChartProps> = ({
  velocity,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <Card className="p-5 animate-pulse">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded mb-4" />
        <div className="h-44 bg-slate-100 dark:bg-slate-850 rounded" />
      </Card>
    );
  }

  const hasData = velocity.length > 0 && velocity.some((p) => p.cumulative_ballots > 0);

  // SVG Chart Dimensions
  const width = 600;
  const height = 180;
  const padLeft = 40;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxVal = Math.max(...velocity.map((v) => v.cumulative_ballots), 5);

  const points = velocity.map((pt, idx) => {
    const x =
      velocity.length === 1
        ? padLeft + chartW / 2
        : padLeft + (idx / (velocity.length - 1)) * chartW;
    const y = padTop + chartH - (pt.cumulative_ballots / maxVal) * chartH;
    return { x, y, pt };
  });

  const linePath = generateSmoothPath(points);
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padTop + chartH} L ${points[0].x} ${padTop + chartH} Z`
      : "";

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-bold">Turnout Velocity</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Cumulative Ballots Cast
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="h-44 flex flex-col items-center justify-center text-center p-4 border border-dashed border-border rounded-lg text-muted-foreground text-xs space-y-1">
            <Activity className="h-6 w-6 text-slate-400 mb-1" />
            <p className="font-semibold text-slate-700 dark:text-slate-300">
              Awaiting ballot data
            </p>
            <p>Ballots cast by voters will appear as a cumulative velocity trend line here.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <svg
              data-testid="velocity-svg-chart"
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-44 overflow-visible"
            >
              <defs>
                <linearGradient id="velocityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line
                x1={padLeft}
                y1={padTop}
                x2={padLeft + chartW}
                y2={padTop}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={padLeft}
                y1={padTop + chartH / 2}
                x2={padLeft + chartW}
                y2={padTop + chartH / 2}
                stroke="currentColor"
                className="text-border"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              <line
                x1={padLeft}
                y1={padTop + chartH}
                x2={padLeft + chartW}
                y2={padTop + chartH}
                stroke="currentColor"
                className="text-border"
                strokeWidth="1"
              />

              {/* Area & Line */}
              {areaPath && <path d={areaPath} fill="url(#velocityGradient)" />}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Data points */}
              {points.map((p, i) => (
                <g key={i}>
                  <circle cx={p.x} cy={p.y} r="3.5" className="fill-white stroke-blue-600 stroke-2" />
                  <text
                    x={p.x}
                    y={padTop + chartH + 18}
                    textAnchor="middle"
                    className="text-[10px] fill-muted-foreground font-mono"
                  >
                    {new Date(p.pt.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </text>
                </g>
              ))}

              {/* Y Axis Labels */}
              <text
                x={padLeft - 8}
                y={padTop + 4}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground font-mono"
              >
                {maxVal}
              </text>
              <text
                x={padLeft - 8}
                y={padTop + chartH}
                textAnchor="end"
                className="text-[10px] fill-muted-foreground font-mono"
              >
                0
              </text>
            </svg>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
