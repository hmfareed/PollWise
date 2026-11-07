# Voter Experience & Portal Redesign Specification

**Status:** Proposed (Awaiting Partner Approval)  
**Author:** Antigravity  
**Date:** 2026-11-07  
**Target:** Option 2 (Split Layout for Entry & Authentication; Focused Canvas for Ballot Voting Booth)

---

## 1. Executive Summary

This document specifies the redesign of the Pollwise voter experience inspired by the split-screen institutional portal design. Rather than copying the mock blindly, the redesign harmonizes the layout with Pollwise's official brand system from `LoginPage.tsx` and `AuthSplitLayout.tsx`, featuring the authentic royal blue brand showcase, official dual-color `PollwiseBrand` logo and emblem, and accurate system instructions reflective of the platform's multi-mode authentication architecture.

Under **Option 2** (approved by the partner), the official split showcase layout is utilized for all voter entry, authentication, and completion steps (Landing, Access Code, Student ID, Identifier Entry, On-Screen OTP, and Confirmation Receipt). Once the ballot begins, the experience transitions seamlessly into a focused, distraction-free wide voting booth canvas where candidate cards, photos, manifestos, and reviews have complete horizontal clarity.

---

## 2. Approaches Considered & Trade-Offs

### Approach 1: Full Split-Screen Across All Steps
- **Description:** Maintain the 50/50 split layout with the left brand showcase throughout the entire voting session, including candidate selection (`voting`) and ballot review (`review`).
- **Pros:** Completely uniform layout across all phases.
- **Cons:** Significantly compresses horizontal space for candidate cards, photos, and manifestos on desktop, especially for elections with multiple candidates per position or long policy statements.

### Approach 2 (Selected): Split Showcase for Entry & Auth; Focused Canvas for Ballot Voting
- **Description:** Wrap pre-voting entry and verification steps (Landing, Access Code, Student ID, Identifier, OTP) and the final Confirmation Receipt in the official split showcase layout. For the actual ballot casting (`instructions`, `voting`, `review`), transition to the focused, full-width distraction-free voting booth canvas.
- **Pros:** Delivers a world-class, branded institutional first impression; optimizes candidate selection ergonomics with full screen width and accessibility; eliminates visual distraction during active vote casting.
- **Cons:** Involves two complementary layout shells within `VotingBoothPage.tsx`.

---

## 3. Detailed Design & Architecture

### 3.1 Left Brand Showcase (Official Brand Identity)
Faithfully implements the left showcase established in `AuthSplitLayout.tsx`:
1. **Desktop (`lg:flex lg:w-1/2 lg:h-full`)**:
   - Deep royal blue backdrop (`bg-[#004BDC]`) with high-resolution showcase artwork (`pollwise-auth-showcase.png` / `2x`).
   - Official accessible link navigating to home (`/`).
   - Screen-reader accessible headline: "Every Vote Matters. Every Election Counts."
   - Cryptographic assurance footer: "Protected by cryptographic ballot assurance."
2. **Mobile (< `lg`)**:
   - Gradient header bar (`bg-gradient-to-r from-[#0037D4] to-[#00228C]`) with `PollwiseBrand theme="dark" size="sm"` and "Institutional Voting Portal" subtitle.

### 3.2 Right Content Panel — Redesigned Landing Step (`VoterLandingStep.tsx`)
Replaces the single centered card with an elevated, modern institutional layout matching the reference geometry:
1. **Top Navigation**:
   - `< Back to Elections` breadcrumb link pointing back to `/elections` with left arrow icon.
2. **Header Block**:
   - **Icon Badge**: Rounded square (`w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900`) housing a vibrant blue vote/ballot icon (`Vote` from `lucide-react`).
   - **Election Title**: Bold, tracking-tight typography (`text-2xl sm:text-3xl font-extrabold text-[#0B1528] dark:text-white`).
   - **Subtitle**: Uppercase / subtle organization name or election description (`text-xs font-semibold tracking-wider text-muted-foreground uppercase`).
   - **Status Pill**:
     - When `isOpen`: Pill with glowing pulse green dot (`bg-emerald-50 text-emerald-700 border-emerald-200`) and label "Voting Open".
     - When not open: Contextual status badges for `Scheduled`, `Paused`, `Closed`, or `Draft`.
3. **Metadata Cards Row**:
   - **Voting Window Card**:
     - Calendar icon (`Calendar` from `lucide-react`).
     - Title: "Voting Window".
     - Formatted dates: `MM/DD/YYYY – MM/DD/YYYY`.
     - Window duration: dynamic calculation (e.g. `(24 hours)`, `(3 days)`, or `(Until Closed)`).
   - **Ballot Security Card**:
     - Shield icon (`ShieldCheck` from `lucide-react`).
     - Title: "Ballot Security".
     - Text: "Your candidate selections are cryptographically decoupled from your institutional identity."
4. **"Before you start" Instructions Card**:
   - Info icon header (`(i)` in blue circle) with "Before you start" heading.
   - Dynamic 4-step instructions matching the election's active authentication configuration:
     - **Physical Slip Access Codes (when `hasAccessCodes` is true)**:
       1. Enter your single-use voting access code found on your physical voter slip.
       2. Provide your Student or Institutional ID to verify eligibility.
       3. Access your private ballot and review all positions sequentially.
       4. Cast your selections anonymously and receive a verified participation receipt.
     - **Institutional Identifier & Challenge OTP (default)**:
       1. Enter your approved {identifier_label} (e.g. institutional email or student ID).
       2. Note the 6-digit verification code generated on-screen to confirm your active session.
       3. Access your private ballot and review all positions sequentially.
       4. Cast your selections anonymously and receive a verified participation receipt.
5. **Primary Action**:
   - High-contrast, vibrant blue `Start Voting →` button (`bg-[#0055FF] hover:bg-[#0047E0]`) with subtle shadow and active scale transitions.
   - Disabled with informative alert when voting is closed or paused.
6. **Support & Privacy Footer**:
   - Left: `Need help? Contact election support` (link or mailto).
   - Right: `Privacy Notice · Read our privacy policy`.

### 3.3 Pre-Voting Authentication Steps in Split Layout
The split layout container will also house:
- `AccessCodeEntryStep.tsx`: Physical slip input with clear uppercase formatting and switch link.
- `StudentIDEntryStep.tsx`: Student ID validation with verified slip badge.
- `IdentifierEntryStep.tsx`: Institutional email / ID entry.
- `OTPVerificationStep.tsx`: 6-digit on-screen challenge code display and verification.
- `SubmissionConfirmedStep.tsx`: Confirmed ballot receipt with confirmation reference and copy button.

### 3.4 Focused Canvas for Ballot Voting (`instructions`, `voting`, `review`)
When moving to active voting:
- Retains top standalone brand header with `PollwiseBrand` and `ShieldCheck` status.
- Gives full screen width to candidate cards, avatar/photos, candidate statements, position requirements, and final review summary.
- Ensures accessibility and responsive comfort on mobile and desktop.

---

## 4. Testing & Verification Plan

1. **Unit & Integration Tests**:
   - Update `frontend/src/test/voting-booth-flow.test.tsx` to ensure all elements (`Back to Elections`, `Voting Open`, `Voting Window`, `Ballot Security`, `Before you start`, `Start Voting`) render and respond to interaction.
   - Verify `frontend/src/test/access-code-voting.test.tsx` passes seamlessly through the split layout.
   - Verify all 29 test suites (156 tests) continue to pass.
2. **Visual & Responsive Verification**:
   - Check desktop layout (`>= lg`): 50% left brand showcase, 50% right content container.
   - Check mobile layout (`< lg`): top dark brand header bar, full-width content area below.
   - Ensure clean dark mode compatibility and styling tokens.
