import React from "react";
import { Badge } from "./badge";

export type ElectionStatus = "draft" | "scheduled" | "open" | "closed" | "tallied" | "published" | "canceled";

interface StatusBadgeProps {
  status: ElectionStatus | string;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case "open":
      return (
        <Badge variant="success" className={className}>
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
          Active / Open
        </Badge>
      );
    case "scheduled":
      return (
        <Badge variant="warning" className={className}>
          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-warning" />
          Scheduled
        </Badge>
      );
    case "published":
      return (
        <Badge variant="default" className={className}>
          Published
        </Badge>
      );
    case "closed":
    case "tallied":
      return (
        <Badge variant="secondary" className={className}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    case "canceled":
      return (
        <Badge variant="danger" className={className}>
          Canceled
        </Badge>
      );
    case "draft":
    default:
      return (
        <Badge variant="outline" className={className}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
  }
};
