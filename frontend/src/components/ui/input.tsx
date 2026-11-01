import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error, rightElement, leftElement, ...props }, ref) => {
    return (
      <div className="relative flex items-center w-full">
        {leftElement && (
          <div className="absolute left-5 flex items-center pointer-events-none text-slate-400">
            {leftElement}
          </div>
        )}
        <input
          type={type}
          className={cn(
            "w-full h-[52px] sm:h-[54px] rounded-2xl border border-slate-200 bg-white px-5 sm:px-6 text-[15px] sm:text-base text-slate-900 placeholder:text-slate-400 transition-all outline-none",
            "hover:border-slate-300",
            "focus:border-[#0055FF] focus:ring-2 focus:ring-[#0055FF]/15",
            "disabled:cursor-not-allowed disabled:opacity-60 disabled:bg-slate-50",
            error && "border-red-400 focus:border-red-500 focus:ring-red-500/15",
            leftElement && "pl-12 sm:pl-14",
            rightElement && "pr-12 sm:pr-14",
            className
          )}
          ref={ref}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-4 sm:right-5 flex items-center pointer-events-auto">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

export interface PasswordInputProps extends Omit<InputProps, "type"> {
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePasswordVisibility?: () => void;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  (
    {
      showPasswordToggle = true,
      isPasswordVisible,
      onTogglePasswordVisibility,
      className,
      rightElement,
      ...props
    },
    ref
  ) => {
    const [internalVisible, setInternalVisible] = React.useState(false);
    const isControlled = typeof isPasswordVisible === "boolean";
    const visible = isControlled ? isPasswordVisible : internalVisible;

    const handleToggle = () => {
      if (onTogglePasswordVisibility) {
        onTogglePasswordVisibility();
      } else {
        setInternalVisible((prev) => !prev);
      }
    };

    // When visible is false (masked password), render EyeOff matching the reference image.
    // When visible is true (revealed text), render Eye.
    const toggleButton = showPasswordToggle ? (
      <button
        type="button"
        onClick={handleToggle}
        className="p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors cursor-pointer select-none"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? (
          <Eye className="h-5 w-5 stroke-[1.75]" />
        ) : (
          <EyeOff className="h-5 w-5 stroke-[1.75]" />
        )}
      </button>
    ) : null;

    return (
      <Input
        type={visible ? "text" : "password"}
        className={className}
        rightElement={rightElement || toggleButton}
        ref={ref}
        {...props}
      />
    );
  }
);
PasswordInput.displayName = "PasswordInput";
