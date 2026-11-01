import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, error, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        <select
          className={cn(
            "w-full appearance-none rounded-2xl border border-slate-200 bg-white px-4 sm:px-5 py-3.5 pr-10 text-sm sm:text-base text-slate-900 shadow-sm transition-all cursor-pointer",
            "hover:border-slate-300",
            "focus:outline-none focus:ring-2 focus:ring-[#0055FF] focus:border-transparent",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50",
            error && "border-red-300 focus:ring-red-500",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-4 pointer-events-none text-slate-400">
          <ChevronDown className="h-4 w-4 stroke-[2]" />
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";
