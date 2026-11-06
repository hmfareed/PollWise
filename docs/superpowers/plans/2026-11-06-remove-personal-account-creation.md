# Remove Personal Account Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove personal account creation from the registration flow and make account creation exclusively for institutional accounts.

**Architecture:** Refactor `RegisterPage.tsx` from a dual-tab personal/institution registration form into a focused, dedicated institution account creation page. The toggle switcher is eliminated, institutional fields (Institution Name, Institution Type, Country) are rendered by default as required fields, and form submission calls `apiClient.register` with `account_type: "institution"`. Update frontend test suites (`auth-pages.test.tsx` and `register-personal-flow.test.tsx`) to validate the dedicated institutional registration behavior and remove obsolete personal tab tests.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, React Router v6, Vitest, React Testing Library.

**Spec:** Direct user requirement: "I would like you to remove the personal account creation and let's use only the institutional creation".

## Global Constraints

- Preserve all existing form styling, split layout design (`AuthSplitLayout`), responsiveness, and fixed-viewport desktop containment.
- Registration must submit to `apiClient.register` with `account_type: "institution"`, `first_name`, `last_name`, `email`, `password`, `institution_name`, `institution_type`, `country`, and `terms_accepted: true`.
- Maintain validation rules: required first & last names, valid email format, min 8-character password, password matching, required institution name, institution type, country, and terms agreement.
- Do not break existing institutional administrator onboarding, session establishment, or backend endpoints.
- Ensure 100% test pass rate across the full test suite (`npm --prefix frontend test -- --run`).

## Review Focus

1. **Direct institutional registration without tabs:** User loads `/register` and sees only the institutional registration form without any "Personal Account" toggle button or option.
2. **Field validation on institutional fields:** Submitting the form with empty institution name or invalid fields triggers appropriate inline error messages.
3. **API submission contract:** Submission payload sent to `apiClient.register` contains `account_type: "institution"` and trimmed field values.
4. **Error handling:** Duplicate email conflicts display error alert with a link to `/login`.
5. **No regressions in test suites:** All unit and component tests in `frontend/src/test/` pass without failure.

---

### Task 1: Refactor RegisterPage to Dedicated Institutional Account Creation

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Test: `frontend/src/test/auth-pages.test.tsx`
- Test: `frontend/src/test/register-personal-flow.test.tsx`

- [ ] **Step 1: Write failing/updated tests for dedicated institutional registration**
Update `frontend/src/test/auth-pages.test.tsx` to verify that `RegisterPage`:
  - Renders the heading "Create an Account" / "Register Your Institution".
  - Does NOT render any "Personal Account" or "Institution Account" tab toggle buttons.
  - Renders institution fields directly (First Name, Last Name, Official Institution Email, Institution Name, Institution Type, Country, Password, Confirm Password, Terms checkbox).
  - Renders the submit button as "Register Institution".
Update `frontend/src/test/register-personal-flow.test.tsx` (or refactor to test the institution registration flow):
  - Validates required fields including institution name and type.
  - Submits to `apiClient.register` with `account_type: "institution"`.
  - Redirects appropriately.
  - Handles email conflict errors.

- [ ] **Step 2: Run frontend tests to confirm failure**
Run: `npm --prefix frontend test -- --run src/test/auth-pages.test.tsx`
Confirm the expected test failures occur due to remaining personal account tabs/buttons.

- [ ] **Step 3: Refactor RegisterPage.tsx**
In `frontend/src/pages/RegisterPage.tsx`:
  - Remove `accountType` state variable (`useState<"personal" | "institution">`).
  - Update email label to always be "Official Institution Email" with placeholder `"admin@university.edu"`.
  - Remove the tab switcher buttons ("Personal Account" / "Institution Account").
  - Make `institutionName`, `institutionType`, and `country` permanent parts of the form inputs (not conditional on `accountType === "institution"`).
  - Add client-side validation that `institutionName.trim()` is not empty: `if (!institutionName.trim()) { setError("Enter your institution name."); return; }`.
  - Simplify `handleSubmit` to call `apiClient.register({ account_type: "institution", first_name: trimmedFirstName, last_name: trimmedLastName, email: trimmedEmail, password, institution_name: institutionName.trim(), institution_type: institutionType, country, terms_accepted: true })`.
  - Update submit button text to: `{isSubmitting ? "Creating Account..." : "Register Institution"}`.

- [ ] **Step 4: Run frontend tests to verify the refactored RegisterPage**
Run: `npm --prefix frontend test -- --run src/test/auth-pages.test.tsx src/test/register-personal-flow.test.tsx`
Verify that all updated tests pass.

- [ ] **Step 5: Run the entire test suite and verify clean build**
Run: `npm --prefix frontend test -- --run`
Run: `backend\.venv\Scripts\pytest.exe backend/tests/test_auth.py`
Verify that all tests pass across frontend and backend.
