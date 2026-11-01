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
            "w-full h-[52px] sm:h-[54px] appearance-none rounded-2xl border border-slate-200 bg-white px-5 sm:px-6 pr-10 text-[15px] sm:text-base text-slate-900 transition-all cursor-pointer outline-none",
            "hover:border-slate-300",
            "focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/15",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <div className="absolute right-4 sm:right-5 pointer-events-none text-slate-400">
          <ChevronDown className="h-4 w-4 stroke-[2]" />
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";
