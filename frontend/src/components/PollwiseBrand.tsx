import React from "react";

interface EmblemProps {
  className?: string;
  size?: number;
}

/**
 * Pollwise Stylized Brand Emblem
 * Faithful vector rendering of the "P" ballot mark with radiant checkmark
 * matching the visual identity in the design mockup.
 */
export const PollwiseEmblem: React.FC<EmblemProps> = ({ className = "h-12 w-12", size }) => {
  const dimensionProps = size ? { width: size, height: size } : {};

  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...dimensionProps}
    >
      <defs>
        {/* Left vertical stem gradient */}
        <linearGradient id="pollwise_stem_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Dynamic checkmark gradient */}
        <linearGradient id="pollwise_check_grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="50%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>

        {/* Shadow filter for checkmark depth */}
        <filter id="emblem_glow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0284C7" floodOpacity="0.3" />
        </filter>
      </defs>

      {/* Top and right loop of the "P" (White / Main body) */}
      <path
        d="M28 20 H74 C89 20 98 29 98 44 C98 59 89 68 74 68 H54 V36 H28 V20 Z"
        fill="#FFFFFF"
      />

      {/* Left lower stem (Deep vibrant blue) */}
      <rect
        x="28"
        y="36"
        width="26"
        height="56"
        rx="2"
        fill="url(#pollwise_stem_grad)"
      />

      {/* Dynamic angled checkmark cutting through and extending right */}
      <path
        d="M48 64 L65 82 L106 38 L95 28 L64 64 L54 53 Z"
        fill="url(#pollwise_check_grad)"
        filter="url(#emblem_glow)"
      />
    </svg>
  );
};

interface BrandProps {
  theme?: "light" | "dark";
  size?: "sm" | "md" | "lg" | "xl";
  showTagline?: boolean;
  className?: string;
  stacked?: boolean;
}

/**
 * Pollwise Brand Logo with Emblem & Dual-Color Wordmark
 * Theme 'dark': White "Poll", Sky-blue "wise" (for dark/blue backgrounds)
 * Theme 'light': Slate "Poll", Blue "wise" (for white/light backgrounds)
 */
export const PollwiseBrand: React.FC<BrandProps> = ({
  theme = "dark",
  size = "md",
  showTagline = false,
  className = "",
  stacked = false,
}) => {
  const sizeMap = {
    sm: { emblem: "h-7 w-7", text: "text-xl", tagline: "text-[10px]" },
    md: { emblem: "h-10 w-10", text: "text-2xl", tagline: "text-xs" },
    lg: { emblem: "h-14 w-14", text: "text-4xl", tagline: "text-sm" },
    xl: { emblem: "h-20 w-20", text: "text-5xl sm:text-6xl", tagline: "text-base tracking-widest" },
  };

  const currentSize = sizeMap[size];
  const pollColor = theme === "dark" ? "text-white" : "text-slate-900";
  const wiseColor = theme === "dark" ? "text-[#38BDF8]" : "text-[#0055FF]";

  if (stacked) {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <PollwiseEmblem className={currentSize.emblem} />
        <div className={`font-bold tracking-tight mt-4 ${currentSize.text}`}>
          <span className={pollColor}>Poll</span>
          <span className={wiseColor}>wise</span>
        </div>
        {showTagline && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/20 text-white/80 font-medium">
            <span>Secure</span>
            <span>•</span>
            <span>Transparent</span>
            <span>•</span>
            <span>Trusted</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <PollwiseEmblem className={currentSize.emblem} />
      <div className="flex flex-col">
        <span className={`font-bold tracking-tight ${currentSize.text}`}>
          <span className={pollColor}>Poll</span>
          <span className={wiseColor}>wise</span>
        </span>
        {showTagline && (
          <span className={`text-white/80 font-medium tracking-wider uppercase ${currentSize.tagline}`}>
            Secure • Transparent • Trusted
          </span>
        )}
      </div>
    </div>
  );
};
