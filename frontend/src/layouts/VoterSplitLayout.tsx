import React from "react";
import { Link } from "react-router-dom";
import { PollwiseBrand } from "../components/PollwiseBrand";
import showcaseArtwork from "../assets/pollwise-auth-showcase.png";
import showcaseArtwork2x from "../assets/pollwise-auth-showcase-2x.png";

interface VoterSplitLayoutProps {
  children: React.ReactNode;
  maxWidthClassName?: string;
}

/**
 * VoterSplitLayout
 * Reusable split-screen layout for voter portal and pre-voting steps.
 * Features Pollwise's official royal-blue brand showcase on the left
 * with the official showcase artwork, emblem, and cryptographic assurance tagline.
 */
export const VoterSplitLayout: React.FC<VoterSplitLayoutProps> = ({
  children,
  maxWidthClassName = "max-w-2xl",
}) => {
  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 lg:overflow-hidden">
      {/* Mobile Branding Bar (visible on < lg) */}
      <div className="lg:hidden bg-gradient-to-r from-[#0037D4] to-[#00228C] p-4 sm:p-5 text-white flex items-center justify-between shadow-sm">
        <Link to="/" className="inline-block">
          <PollwiseBrand theme="dark" size="sm" />
        </Link>
        <span className="text-xs text-sky-200 font-medium">Official Voting Portal</span>
      </div>

      {/* Left Brand Showcase (visible on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 lg:h-full relative overflow-hidden bg-[#004BDC] text-white flex-col justify-between select-none">
        <img
          src={showcaseArtwork}
          srcSet={`${showcaseArtwork} 1x, ${showcaseArtwork2x} 2x`}
          alt="Pollwise Institutional Voting - Every Vote Matters, Every Election Counts"
          className="absolute -top-[30px] inset-x-0 w-full h-[calc(100%+30px)] object-cover object-top select-none pointer-events-none"
          loading="eager"
          fetchPriority="high"
        />

        {/* Top Brand Link overlay for accessibility & navigation */}
        <div className="relative z-10 px-8 xl:px-14 pt-4">
          <Link
            to="/"
            className="inline-block w-52 h-20 cursor-pointer rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Pollwise Home"
          />
        </div>

        {/* Semantic accessible headline for screen readers */}
        <div className="sr-only">
          <h1>
            Every Vote Matters.
            <br />
            Every Election <span className="text-[#38BDF8]">Counts.</span>
          </h1>
          <p>A modern platform for secure and transparent institutional elections.</p>
        </div>

        {/* Bottom subtle copyright assurance banner */}
        <div className="relative z-10 px-8 xl:px-14 pb-5 text-xs text-blue-200/70 font-normal">
          © {new Date().getFullYear()} Pollwise Inc. Protected by cryptographic ballot assurance.
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 lg:h-full flex flex-col items-center p-4 sm:p-8 lg:p-10 xl:p-12 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className={`w-full ${maxWidthClassName} my-auto py-4`}>
          {children}
        </div>
      </div>
    </div>
  );
};
