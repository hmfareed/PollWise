import React from "react";
import { Link } from "react-router-dom";
import { PollwiseBrand } from "../components/PollwiseBrand";
import showcaseArtwork from "../assets/pollwise-auth-showcase.png";
import showcaseArtwork2x from "../assets/pollwise-auth-showcase-2x.png";

interface AuthSplitLayoutProps {
  children: React.ReactNode;
}

/**
 * AuthSplitLayout
 * Reusable full-viewport split-screen layout for authentication & onboarding pages.
 * Faithfully matches the Pollwise Secure Login design with left royal-blue showcase
 * and right elevated card container.
 */
export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-white lg:overflow-hidden">
      {/* Mobile Branding Bar (visible on < lg) */}
      <div className="lg:hidden bg-gradient-to-r from-[#0037D4] to-[#00228C] p-6 text-white flex items-center justify-between">
        <Link to="/" className="inline-block">
          <PollwiseBrand theme="dark" size="sm" />
        </Link>
        <span className="text-xs text-sky-200 font-medium">Institutional Voting</span>
      </div>

      {/* Left Brand Showcase (visible on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 lg:h-full relative overflow-hidden bg-[#004BDC] text-white flex-col justify-between select-none">
        {/* Full Showcase Artwork seamlessly integrated */}
        <img
          src={showcaseArtwork}
          srcSet={`${showcaseArtwork} 1x, ${showcaseArtwork2x} 2x`}
          alt="Pollwise Institutional Voting - Every Vote Matters, Every Election Counts"
          className="absolute -top-[30px] inset-x-0 w-full h-[calc(100%+30px)] object-cover object-top select-none pointer-events-none"
          loading="eager"
          fetchPriority="high"
        />

        {/* Top Brand Link overlay for accessibility & navigation */}
        <div className="relative z-10 px-8 xl:px-14 pt-2 xl:pt-4">
          <Link
            to="/"
            className="inline-block w-52 h-20 cursor-pointer rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Pollwise Home"
          />
        </div>

        {/* Semantic accessible headline for screen readers and SEO */}
        <div className="sr-only">
          <h1>
            Every Vote Matters.
            <br />
            Every Election <span className="text-[#38BDF8]">Counts.</span>
          </h1>
          <p>A modern platform for secure and transparent institutional elections.</p>
        </div>

        {/* Bottom subtle copyright assurance banner */}
        <div className="relative z-10 px-8 xl:px-14 pb-5 text-xs text-blue-200/60 font-normal">
          © {new Date().getFullYear()} Pollwise Inc. Protected by cryptographic ballot assurance.
        </div>
      </div>

      {/* Right Form Area (seamless white background) */}
      <div className="flex-1 lg:h-full flex flex-col items-center p-6 sm:p-10 lg:p-12 xl:p-16 overflow-y-auto bg-white">
        <div className="w-full max-w-[460px] my-auto py-6">
          {children}
        </div>
      </div>
    </div>
  );
};
