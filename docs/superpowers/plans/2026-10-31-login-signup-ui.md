# Login and Signup Interface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the high-fidelity login and signup page interfaces matching the visual design in `Pollwise Secure Login Interface.jpg` with a reusable split-screen layout, custom vector Pollwise emblem, password visibility toggles, and dual registration modes (personal and institution).

**Architecture:** Create a reusable `AuthSplitLayout` component encapsulating the royal-blue left showcase (custom vector logo, tagline, typography, headline) and housing the elevated floating card on the right. Refactor `LoginPage.tsx` and `RegisterPage.tsx` to adopt this layout and aesthetics with real API integration and accessibility.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Lucide React icons, TanStack Query, Vitest, React Testing Library.

**Spec:** [`user interface/Pollwise Secure Login Interface.jpg`](file:///c:/Projects/PollWise/user%20interface/Pollwise%20Secure%20Login%20Interface.jpg), [`docs/spec/04-frontend-routes-components.md`](file:///c:/Projects/PollWise/docs/spec/04-frontend-routes-components.md).

## Global Constraints
- Faithful alignment with `Pollwise Secure Login Interface.jpg`: royal blue gradient left showcase (`#0028A5` / `#0047FF` / `#021359`), stylized Pollwise emblem, headline "Every Vote Matters. Every Election Counts." (with "Counts." in cyan), floating right card, icon-adorned inputs, trust shield banner.
- Password visibility toggle (`Eye`/`EyeOff`) on password inputs.
- Keep full functionality of `LoginPage` (login with redirection) and `RegisterPage` (personal vs institution registration, email verification state, resend token cooldown).
- All Vitest frontend tests must pass.

## Review Focus
- Responsive layout collapse: On mobile/tablet (`< 1024px`), stack or cleanly center the card while maintaining legible branding.
- Password visibility state toggle: Toggling eye icon switches input type between `password` and `text` without resetting input values.
- Form accessibility: Labels properly associated with input IDs, visible error alerts with ARIA roles.
- Remember me persistence: Toggle state handled cleanly.
- Link routing: "Forgot password?", "Create an account", and "Sign in" correctly route to their respective pages.

---

### Task 1: Create Custom Pollwise Emblem and Brand SVG Component

**Files:**
- Create: `frontend/src/components/PollwiseBrand.tsx`
- Test: `frontend/src/test/ui-components.test.tsx`

**Interfaces:**
- Produces: `<PollwiseEmblem className="..." />`, `<PollwiseLogo size="sm"|"md"|"lg" theme="light"|"dark" />`

- [ ] **Step 1: Write test for PollwiseBrand component**

In `frontend/src/test/ui-components.test.tsx`, add tests verifying `PollwiseBrand` renders the custom emblem SVG and dual-colored wordmark ("Poll" in white/slate, "wise" in sky-blue).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/ui-components.test.tsx`
Expected: FAIL (cannot resolve `PollwiseBrand`).

- [ ] **Step 3: Implement PollwiseBrand in `frontend/src/components/PollwiseBrand.tsx`**

Implement vector SVG reproducing the emblem in the mockup (ballot box glyph with radiant cyan-blue gradient checkmark) and the typography ("Poll" + "wise").

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/ui-components.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/PollwiseBrand.tsx frontend/src/test/ui-components.test.tsx
git commit -m "feat(ui): add high-fidelity Pollwise emblem and brand component"
```

---

### Task 2: Create Reusable Auth Split Layout Component

**Files:**
- Create: `frontend/src/layouts/AuthSplitLayout.tsx`
- Test: `frontend/src/test/AppShell.test.tsx`

**Interfaces:**
- Consumes: `<PollwiseBrand />`
- Produces: `<AuthSplitLayout>{children}</AuthSplitLayout>`

- [ ] **Step 1: Implement `frontend/src/layouts/AuthSplitLayout.tsx`**

Build responsive two-column layout:
- Left pane (desktop `lg:flex lg:w-1/2`):
  - Deep blue background gradient (`bg-gradient-to-br from-[#0047FF] via-[#0028A5] to-[#021359]`).
  - Subtle decorative curved fluid waves (SVG background paths with low opacity).
  - Brand header with `PollwiseLogo` (white text + cyan "wise") and tagline: "Secure  •  Transparent  •  Trusted".
  - Main hero copy:
    - Display headline: "Every Vote Matters.<br />Every Election <span class='text-sky-400'>Counts.</span>"
    - Subtext: "A modern platform for secure and transparent institutional elections."
- Right pane (`w-full lg:w-1/2`):
  - Subtle off-white backdrop (`bg-slate-50/70` or `bg-white`).
  - Centered container for the floating auth card.

- [ ] **Step 2: Add test verifying layout renders left brand showcase and children**

In `frontend/src/test/AppShell.test.tsx`, add test for `AuthSplitLayout`.

- [ ] **Step 3: Run tests to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/AppShell.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/layouts/AuthSplitLayout.tsx frontend/src/test/AppShell.test.tsx
git commit -m "feat(ui): create responsive AuthSplitLayout matching design mockup"
```

---

### Task 3: Implement Pixel-Perfect Login Page

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/test/auth-pages.test.tsx`

**Interfaces:**
- Consumes: `<AuthSplitLayout />`, `useAuth()`, Lucide icons (`Mail`, `Lock`, `Eye`, `EyeOff`, `ArrowRight`, `ShieldCheck`)
- Produces: Upgraded `LoginPage` component matching mockup

- [ ] **Step 1: Update test in `frontend/src/test/auth-pages.test.tsx`**

Update `it("renders LoginPage with email and password inputs")` to check for:
- "Welcome Back" heading
- "Sign in to your Pollwise account" subheading
- "Enter your email address" placeholder
- "Enter your password" placeholder
- "Remember me" checkbox
- "Forgot password?" link
- "Sign In" button with arrow
- Security trust badge: "Your data is secure with Pollwise"

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/auth-pages.test.tsx`
Expected: FAIL with missing text.

- [ ] **Step 3: Redesign `frontend/src/pages/LoginPage.tsx`**

Implement complete design:
- Wrap with `<AuthSplitLayout>`.
- Floating card (`bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8 sm:p-10 max-w-md w-full`).
- "Welcome Back" title (`text-3xl font-extrabold text-slate-900 tracking-tight`).
- "Sign in to your Pollwise account" description.
- Email input with left `Mail` icon (`text-slate-400`), placeholder "Enter your email address", focus ring.
- Password input with left `Lock` icon, placeholder "Enter your password", and right clickable `Eye`/`EyeOff` toggle button.
- "Remember me" custom-styled checkbox and "Forgot password?" link.
- Primary full-width button: `Sign In →` (`bg-[#0055FF] hover:bg-[#0047E0] text-white font-semibold py-3 px-4 rounded-xl shadow-md shadow-blue-500/20`).
- Divider with "Don't have an account? Create an account" link to `/register`.
- Bottom trust badge: Light blue pill (`bg-blue-50/80 border border-blue-100/80 rounded-2xl p-4 flex items-center gap-3.5`) featuring blue `ShieldCheck` icon, "Your data is secure with Pollwise", and "Built with advanced security standards."
- Preserves full backend authentication flow, error display, and redirect params.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/auth-pages.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/test/auth-pages.test.tsx
git commit -m "feat(auth): build pixel-perfect login page matching design mockup"
```

---

### Task 4: Implement Matching High-Fidelity Signup Page

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/test/auth-pages.test.tsx`

**Interfaces:**
- Consumes: `<AuthSplitLayout />`, `apiClient.register()`, `apiClient.resendVerificationEmail()`
- Produces: Upgraded `RegisterPage` matching the visual system

- [ ] **Step 1: Update registration tests in `frontend/src/test/auth-pages.test.tsx`**

Ensure test suite exercises both personal and institutional registration tabs, input fields, and password toggles within the new layout.

- [ ] **Step 2: Redesign `frontend/src/pages/RegisterPage.tsx`**

Implement registration page adopting the exact same split-screen design:
- Wrap with `<AuthSplitLayout>`.
- Floating card matching login page dimensions and elevation.
- Header: "Create an Account" & "Get started with secure institutional voting".
- Segmented pill switcher: "Personal Account (Voter)" vs "Institution Account" with clean active states.
- Clean inputs with embedded left icons (`User`, `Mail`, `Lock`, `Building2`, `Globe`).
- Password visibility toggles for password and confirm password fields.
- Terms of service and privacy policy checkbox.
- Primary submit button: `Create Account →` or `Register Institution →`.
- Link to Sign In: "Already have an account? Sign in".
- Bottom trust security banner matching login page.
- Success confirmation screen for email verification dispatch with resend timer.

- [ ] **Step 3: Run frontend tests to verify all pass**

Run: `npm --prefix frontend test -- --run`
Expected: All test files pass.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/RegisterPage.tsx frontend/src/test/auth-pages.test.tsx
git commit -m "feat(auth): build matching high-fidelity registration interface"
```

---

### Task 5: End-to-End Visual & Functional Verification

**Files:**
- Test: Full frontend test suite + verification of build artifacts

- [ ] **Step 1: Run complete test suite and typecheck**

Run:
```powershell
npm --prefix frontend test -- --run
npm --prefix frontend run build
```
Expected: All tests pass and Vite production bundle compiles cleanly.

- [ ] **Step 2: Commit any final refinements**

```bash
git commit --allow-empty -m "chore(auth): complete verification of login and signup interfaces"
```
