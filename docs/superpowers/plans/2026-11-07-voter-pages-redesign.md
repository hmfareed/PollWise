# Voter Pages Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Pollwise voter experience inspired by the modern split-screen institutional portal design, utilizing the official royal-blue login showcase and official `PollwiseBrand` logo on the left, an elevated right-hand panel with dynamic system instructions, and a focused canvas for candidate voting (Option 2).

**Architecture:** Create a reusable `VoterSplitLayout` matching the official `AuthSplitLayout` branding and artwork while supporting elevated width for voter entry steps. Redesign `VoterLandingStep` with `< Back to Elections` breadcrumbs, election header with glowing status pill, two-column metadata (Voting Window with duration & Ballot Security), dynamic "Before you start" system instructions, vibrant action button, and support/privacy links. Update `VotingBoothPage` to host pre-voting and confirmation steps in the split layout while preserving the wide focused layout for active ballot casting and review.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React icons, TanStack Query, Vitest, React Testing Library.

**Spec:** [`docs/superpowers/specs/2026-11-07-voter-pages-redesign-design.md`](file:///c:/Projects/PollWise/docs/superpowers/specs/2026-11-07-voter-pages-redesign-design.md)

## Global Constraints

- Must use official login showcase assets: `pollwise-auth-showcase.png`, `pollwise-auth-showcase-2x.png`, and `PollwiseBrand` (with authentic `/pollwise-emblem.png`). Never copy generic 3D toy illustrations or generic checkmark logos from the reference mockup.
- Dynamic system instructions: Must display authentic Pollwise workflow steps reflecting the active authentication method (physical access code slips + Student ID verification vs. institutional identifier + 6-digit on-screen OTP code) rather than the mock's static text.
- Must preserve all voting logic, state transitions, draft synchronization, kiosk resets, and atomic ballot submission invariants in `VotingBoothPage.tsx`.
- All 156 existing frontend tests across 29 test files must continue to pass.

## Review Focus

1. **Responsive behavior**: On screens `< lg`, the left showcase collapses to the official top dark gradient bar (`PollwiseBrand`), and the right panel expands cleanly without horizontal scroll.
2. **Dynamic duration calculation**: Calculates human-readable duration between `opens_at` and `closes_at` (e.g., "(24 hours)", "(3 days)", "(Until Closed)") handling null/undefined safely.
3. **Authentication mode awareness**: "Before you start" instructions accurately guide the voter according to whether `hasAccessCodes` is true (physical slip flow) or false (institutional identifier flow).
4. **Election status handling**: When election is not `open` (e.g. `paused`, `scheduled`, `closed`, `draft`), the status badge and banner clearly reflect the state, and the `Start Voting` button is disabled.
5. **Focused voting booth transition**: When moving from authentication/instructions to `voting` and `review`, the layout smoothly transitions to full canvas mode so candidate cards and manifestos have ample room.

---

### Task 1: Create `VoterSplitLayout` Component

**Files:**
- Create: `frontend/src/layouts/VoterSplitLayout.tsx`
- Test: `frontend/src/test/ui-components.test.tsx`

**Interfaces:**
- Produces: `<VoterSplitLayout maxWidthClassName="max-w-2xl">{children}</VoterSplitLayout>`

- [ ] **Step 1: Write tests for `VoterSplitLayout` in `frontend/src/test/ui-components.test.tsx`**

Add tests verifying `VoterSplitLayout`:
1. Renders the official left brand showcase with `showcaseArtwork` and accessible alt text.
2. Renders the mobile branding bar with `PollwiseBrand` on small screens.
3. Renders children within the right panel with customizable max width.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/ui-components.test.tsx`  
Expected: FAIL (cannot resolve `VoterSplitLayout`).

- [ ] **Step 3: Implement `VoterSplitLayout` in `frontend/src/layouts/VoterSplitLayout.tsx`**

Implement using the official royal-blue showcase from `AuthSplitLayout.tsx`:
```tsx
import React from "react";
import { Link } from "react-router-dom";
import { PollwiseBrand } from "../components/PollwiseBrand";
import showcaseArtwork from "../assets/pollwise-auth-showcase.png";
import showcaseArtwork2x from "../assets/pollwise-auth-showcase-2x.png";

interface VoterSplitLayoutProps {
  children: React.ReactNode;
  maxWidthClassName?: string;
}

export const VoterSplitLayout: React.FC<VoterSplitLayoutProps> = ({
  children,
  maxWidthClassName = "max-w-2xl",
}) => {
  return (
    <div className="min-h-screen lg:h-screen w-full flex flex-col lg:flex-row bg-slate-50 dark:bg-slate-950 lg:overflow-hidden">
      {/* Mobile Branding Bar (< lg) */}
      <div className="lg:hidden bg-gradient-to-r from-[#0037D4] to-[#00228C] p-4 sm:p-5 text-white flex items-center justify-between shadow-sm">
        <Link to="/" className="inline-block">
          <PollwiseBrand theme="dark" size="sm" />
        </Link>
        <span className="text-xs text-sky-200 font-medium">Official Voting Portal</span>
      </div>

      {/* Left Brand Showcase (lg+) */}
      <div className="hidden lg:flex lg:w-1/2 lg:h-full relative overflow-hidden bg-[#004BDC] text-white flex-col justify-between select-none">
        <img
          src={showcaseArtwork}
          srcSet={`${showcaseArtwork} 1x, ${showcaseArtwork2x} 2x`}
          alt="Pollwise Institutional Voting - Every Vote Matters, Every Election Counts"
          className="absolute -top-[30px] inset-x-0 w-full h-[calc(100%+30px)] object-cover object-top select-none pointer-events-none"
          loading="eager"
          fetchPriority="high"
        />

        <div className="relative z-10 px-8 xl:px-14 pt-4">
          <Link
            to="/"
            className="inline-block w-52 h-20 cursor-pointer rounded-lg focus:outline-none focus:ring-2 focus:ring-white/40"
            aria-label="Pollwise Home"
          />
        </div>

        <div className="sr-only">
          <h1>
            Every Vote Matters.
            <br />
            Every Election <span className="text-[#38BDF8]">Counts.</span>
          </h1>
          <p>A modern platform for secure and transparent institutional elections.</p>
        </div>

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/ui-components.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/layouts/VoterSplitLayout.tsx frontend/src/test/ui-components.test.tsx
git commit -m "feat(voter): create VoterSplitLayout with official brand showcase"
```

---

### Task 2: Redesign `VoterLandingStep` with Mockup Geometry & System Instructions

**Files:**
- Modify: `frontend/src/components/voter/VoterLandingStep.tsx`
- Test: `frontend/src/test/voting-booth-flow.test.tsx`

**Interfaces:**
- Consumes:
  ```ts
  interface VoterLandingStepProps {
    electionTitle: string;
    electionDescription?: string | null;
    opensAt?: string | null;
    closesAt?: string | null;
    isOpen: boolean;
    electionStatus?: string;
    electionId?: string;
    hasAccessCodes?: boolean;
    identifierLabel?: string;
    onStart: () => void;
  }
  ```

- [ ] **Step 1: Write unit tests for redesigned `VoterLandingStep`**

In `frontend/src/test/voting-booth-flow.test.tsx`:
1. Verify `< Back to Elections` link is present with href `/elections`.
2. Verify election title and uppercase subtitle are rendered.
3. Verify status badge displays glowing "Voting Open".
4. Verify "Voting Window" displays formatted dates and calculated duration.
5. Verify "Ballot Security" guarantees cryptographic decoupling.
6. Verify "Before you start" displays 4 dynamic system instruction steps.
7. Verify "Need help? Contact election support" and "Privacy Notice" links are rendered.
8. Verify "Start Voting" button calls `onStart` when clicked.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/voting-booth-flow.test.tsx`  
Expected: FAIL (missing new elements like "Back to Elections", "Before you start", duration, etc.).

- [ ] **Step 3: Implement redesigned `VoterLandingStep` in `frontend/src/components/voter/VoterLandingStep.tsx`**

Features to implement:
1. Helper function `formatVotingWindow(opensAt?: string | null, closesAt?: string | null)` returning date range and duration (e.g. `(24 hours)`, `(3 days)`, `(Immediate)`).
2. Header with `< Back to Elections` link (`/elections`), rounded icon container with blue `Vote` icon, election title, uppercase subtitle/description, and status badge with pulsing green dot.
3. Two-column grid (`grid grid-cols-1 md:grid-cols-2 gap-4`):
   - Left: Calendar icon + "Voting Window" + date range + duration.
   - Right: ShieldCheck icon + "Ballot Security" + cryptographic guarantee.
4. "Before you start" box (`bg-blue-50/60 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-2xl p-5`):
   - Header with `Info` icon and "Before you start".
   - 4 numbered steps with circular badges:
     - When `hasAccessCodes` is true:
       1. Enter the alphanumeric access code found on your physical voter slip.
       2. Enter your Student or Institutional ID to verify eligibility.
       3. Access your confidential ballot and review positions sequentially.
       4. Complete your vote anonymously and receive your verifiable receipt.
     - When default (identifier):
       1. Enter your approved {identifierLabel || "institutional email or ID"}.
       2. Note the 6-digit verification code generated on this screen.
       3. Enter the code to verify your session and access the ballot.
       4. Complete your vote anonymously and receive your verifiable receipt.
5. When not open: Informative status banner with alert icon.
6. Primary `Start Voting →` button (`w-full py-4 rounded-xl font-semibold text-white bg-[#0055FF] hover:bg-[#0047E0] shadow-md shadow-blue-500/20 active:scale-[0.99]`).
7. Footer row with `Need help? Contact election support` and `Privacy Notice · Read our privacy policy`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/voting-booth-flow.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voter/VoterLandingStep.tsx frontend/src/test/voting-booth-flow.test.tsx
git commit -m "feat(voter): redesign VoterLandingStep with institutional portal layout"
```

---

### Task 3: Integrate Split Layout in `VotingBoothPage` and Style Pre-Voting Steps

**Files:**
- Modify: `frontend/src/pages/VotingBoothPage.tsx`
- Modify: `frontend/src/components/voter/AccessCodeEntryStep.tsx`
- Modify: `frontend/src/components/voter/StudentIDEntryStep.tsx`
- Modify: `frontend/src/components/voter/IdentifierEntryStep.tsx`
- Modify: `frontend/src/components/voter/OTPVerificationStep.tsx`
- Modify: `frontend/src/components/voter/SubmissionConfirmedStep.tsx`
- Test: `frontend/src/test/access-code-voting.test.tsx`
- Test: `frontend/src/test/voting-booth-flow.test.tsx`

- [ ] **Step 1: Write integration tests for `VotingBoothPage` phase transitions**

Ensure tests in `frontend/src/test/voting-booth-flow.test.tsx` and `frontend/src/test/access-code-voting.test.tsx` verify:
1. Landing step renders inside `VoterSplitLayout`.
2. Access code / Identifier / OTP / Student ID steps render seamlessly within the split layout.
3. Transition to `instructions`, `voting`, and `review` switches to the focused canvas layout.
4. Transition to `confirmed` renders receipt in the split layout.

- [ ] **Step 2: Run tests to verify initial state**

Run: `npm --prefix frontend test -- --run src/test/voting-booth-flow.test.tsx src/test/access-code-voting.test.tsx`  
Expected: PASS/FAIL based on current state.

- [ ] **Step 3: Update `VotingBoothPage.tsx` layout logic**

In `frontend/src/pages/VotingBoothPage.tsx`:
1. Import `VoterSplitLayout`.
2. Define `const isPreVotingOrReceipt = ["landing", "access_code", "student_id", "identifier", "otp", "confirmed"].includes(phase);`.
3. If `isPreVotingOrReceipt`, wrap the step in `<VoterSplitLayout maxWidthClassName={phase === "landing" ? "max-w-2xl" : "max-w-lg"}>`.
4. If in ballot casting mode (`instructions`, `voting`, `review`), keep the focused wide layout with the top brand header bar and footer.
5. Pass `hasAccessCodes` and `identifierLabel={label}` to `VoterLandingStep`.
6. Ensure subtle visual styling polish across `AccessCodeEntryStep`, `StudentIDEntryStep`, `IdentifierEntryStep`, `OTPVerificationStep`, and `SubmissionConfirmedStep` to match the `#0055FF` brand palette and rounded corner hierarchy.

- [ ] **Step 4: Run tests to verify all voter tests pass**

Run: `npm --prefix frontend test -- --run src/test/voting-booth-flow.test.tsx src/test/access-code-voting.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Run full frontend test suite**

Run: `npm --prefix frontend test`  
Expected: All 29 test files (156 tests) PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/VotingBoothPage.tsx frontend/src/components/voter/ frontend/src/test/
git commit -m "feat(voter): wire VoterSplitLayout across voter auth flow and verify test suite"
```

---

### Task 4: Final Quality Verification & Polish

**Files:**
- Test: All frontend tests and Oxlint / TypeScript check

- [ ] **Step 1: Run TypeScript type check and Oxlint**

Run: `npm --prefix frontend run build` and `npm --prefix frontend run lint`  
Expected: 0 errors, successful Vite production build.

- [ ] **Step 2: Run complete test suite**

Run: `npm --prefix frontend test`  
Expected: 156/156 tests passing.

- [ ] **Step 3: Commit any final refinements**

```bash
git commit --allow-empty -m "chore(voter): complete voter pages redesign verification"
```
