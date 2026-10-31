import React from "react";

interface EmblemProps {
  className?: string;
  size?: number;
  alt?: string;
}

/**
 * Pollwise Stylized Brand Emblem
 * Faithful rendering of the official Pollwise logo emblem
 * from user interface/Pollwise Logo.png.
 */
export const PollwiseEmblem: React.FC<EmblemProps> = ({
  className = "h-12 w-auto",
  size,
  alt = "Pollwise Emblem",
}) => {
  const dimensionProps = size ? { width: size, height: size } : {};

  return (
    <img
      src="/pollwise-emblem.png"
      srcSet="/pollwise-emblem.png 1x, /pollwise-emblem-2x.png 2x, /pollwise-emblem-4x.png 4x"
      alt={alt}
      className={`object-contain inline-block select-none ${className}`}
      {...dimensionProps}
    />
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
 * Pollwise Brand Logo with Authentic Emblem & Dual-Color Wordmark
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
    sm: { emblem: "h-7 w-auto", text: "text-xl", tagline: "text-[10px]" },
    md: { emblem: "h-10 w-auto", text: "text-2xl", tagline: "text-xs" },
    lg: { emblem: "h-14 w-auto", text: "text-4xl", tagline: "text-sm" },
    xl: { emblem: "h-16 w-auto", text: "text-5xl sm:text-6xl", tagline: "text-base tracking-widest" },
  };

  const currentSize = sizeMap[size];
  const pollColor = theme === "dark" ? "text-white" : "text-slate-900";
  const wiseColor = theme === "dark" ? "text-[#38BDF8]" : "text-[#0055FF]";

  if (stacked) {
    return (
      <div className={`flex flex-col items-center text-center ${className}`}>
        <PollwiseEmblem className={currentSize.emblem} />
        <div className={`font-extrabold tracking-tight mt-3 ${currentSize.text}`}>
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
    <div className={`inline-flex items-center gap-3.5 ${className}`}>
      <PollwiseEmblem className={currentSize.emblem} />
      <div className="flex flex-col">
        <span className={`font-extrabold tracking-tight leading-none ${currentSize.text}`}>
          <span className={pollColor}>Poll</span>
          <span className={wiseColor}>wise</span>
        </span>
        {showTagline && (
          <span className={`text-white/80 font-medium tracking-wider uppercase mt-1 ${currentSize.tagline}`}>
            Secure • Transparent • Trusted
          </span>
        )}
      </div>
    </div>
  );
};

export const PollwiseLogo: React.FC<{
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  theme?: "light" | "dark";
  stacked?: boolean;
}> = ({ className = "", size = "md", theme = "dark", stacked = false }) => {
  return <PollwiseBrand size={size} theme={theme} stacked={stacked} className={className} />;
};
