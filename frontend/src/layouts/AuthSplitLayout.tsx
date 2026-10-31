import React from "react";
import { Link } from "react-router-dom";
import { PollwiseBrand } from "../components/PollwiseBrand";

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
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* Mobile Branding Bar (visible on < lg) */}
      <div className="lg:hidden bg-gradient-to-r from-[#0037D4] to-[#00228C] p-6 text-white flex items-center justify-between">
        <Link to="/" className="inline-block">
          <PollwiseBrand theme="dark" size="sm" />
        </Link>
        <span className="text-xs text-sky-200 font-medium">Institutional Voting</span>
      </div>

      {/* Left Brand Showcase (visible on lg+) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#0055FF] via-[#002FA7] to-[#021359] text-white flex-col justify-between p-14 xl:p-18 select-none">
        {/* Background decorative fluid ambient shapes */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <svg
            className="absolute -top-32 -left-32 w-[650px] h-[650px] text-blue-400 blur-3xl opacity-20"
            fill="currentColor"
            viewBox="0 0 200 200"
          >
            <path d="M42.7,-62.9C53.8,-52.8,60.5,-38.7,66.3,-24C72.1,-9.3,77,6,73.4,19.8C69.8,33.6,57.7,45.8,44.5,55.8C31.3,65.8,17,73.6,1.4,71.7C-14.2,69.8,-28.4,58.2,-41.8,47.4C-55.2,36.6,-67.8,26.6,-73.2,13.2C-78.6,-0.2,-76.8,-17,-68.8,-30.4C-60.8,-43.8,-46.6,-53.8,-32.8,-62.9C-19,-72,-5.6,-80.2,7,-91.1C19.6,-102,31.6,-73,42.7,-62.9Z" transform="translate(100 100)" />
          </svg>
          <svg
            className="absolute bottom-0 right-0 w-[800px] h-[800px] text-sky-300 blur-3xl opacity-15"
            fill="currentColor"
            viewBox="0 0 200 200"
          >
            <path d="M45.7,-77.3C58.8,-71.1,68.7,-58,74.5,-43.7C80.3,-29.4,82,-13.9,81.1,1.5C80.2,16.9,76.7,32.2,68.9,45.2C61.1,58.2,49,68.9,35.3,74.8C21.6,80.7,6.3,81.8,-8.9,80.2C-24.1,78.6,-39.2,74.3,-51.7,66.1C-64.2,57.9,-74.1,45.8,-79.3,32C-84.5,18.2,-85,2.7,-81.4,-11.7C-77.8,-26.1,-70.1,-39.4,-59.4,-47.9C-48.7,-56.4,-35,-60.1,-21.8,-66.2C-8.6,-72.3,4.1,-80.8,18.9,-84.8C33.7,-88.8,32.6,-83.5,45.7,-77.3Z" transform="translate(100 100)" />
          </svg>
        </div>

        {/* Top brand lockup */}
        <div className="relative z-10">
          <Link to="/" className="inline-flex flex-col items-start group">
            <PollwiseBrand theme="dark" size="lg" stacked={false} />
            <div className="flex items-center gap-2.5 mt-3 pt-3 border-t border-white/20 text-xs tracking-wider uppercase text-blue-100/90 font-medium">
              <span>Secure</span>
              <span className="text-sky-300">•</span>
              <span>Transparent</span>
              <span className="text-sky-300">•</span>
              <span>Trusted</span>
            </div>
          </Link>
        </div>

        {/* Hero Headline & Subtext matching mockup */}
        <div className="relative z-10 max-w-lg my-auto pt-16 pb-12">
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight leading-[1.15] text-white">
            Every Vote Matters.
            <br />
            Every Election{" "}
            <span className="text-[#38BDF8] drop-shadow-sm">Counts.</span>
          </h1>
          <p className="mt-6 text-base xl:text-lg text-blue-100/85 leading-relaxed font-normal">
            A modern platform for secure and transparent institutional elections.
          </p>
        </div>

        {/* Bottom subtle copyright / reassurance */}
        <div className="relative z-10 text-xs text-blue-200/60 font-normal">
          © {new Date().getFullYear()} Pollwise Inc. Protected by cryptographic ballot assurance.
        </div>
      </div>

      {/* Right Form Card Area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 lg:p-12 xl:p-16 overflow-y-auto">
        <div className="w-full max-w-lg my-auto py-6">
          {children}
        </div>
      </div>
    </div>
  );
};
