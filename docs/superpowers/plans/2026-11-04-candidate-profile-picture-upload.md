# Candidate Profile Picture Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable election administrators to upload and manage profile pictures for candidates across the admin election management interfaces and have them displayed across candidate lists and voter ballots.

**Architecture:** 
1. Backend: Implement a dedicated file upload endpoint (`POST /api/v1/uploads/candidate-photo`) validating MIME types and size, saving files safely to a persistent uploads directory, and mounting `/static` via FastAPI `StaticFiles` to serve uploaded images.
2. Frontend: Add `uploadCandidatePhoto` to `apiClient`, build a dedicated `CandidatePhotoUpload` component with preview and removal, and integrate it into the "Add Candidate" modal in `AdminDashboardPage` and the "New Candidate" section in `ElectionDetailPage`.
3. Display: Enhance candidate cards in both pages to render the candidate's profile picture when available, cleanly falling back to initial-based avatar badges.

**Tech Stack:** FastAPI, Python 3.14, SQLAlchemy 2, React 19, TypeScript, Vite, Tailwind CSS, Lucide icons, Vitest, Pytest.

**Spec:** [docs/27-complete-signup-to-admin-panel-specification.md](file:///c:/Projects/PollWise/docs/27-complete-signup-to-admin-panel-specification.md) Section 11 (Candidate Management).

## Global Constraints
- Target platform: Windows / cross-platform compatible file paths.
- Image constraints: PNG, JPEG, WebP, GIF; maximum 5MB.
- Security: Sanitize filenames using UUIDs; do not trust user-supplied file paths; prevent directory traversal.
- Backward compatibility: Candidate `photo_url` remains optional (`null` allowed). Existing candidate records and tests without photos must continue to function without error.

## Review Focus
1. Non-image file upload attempt (e.g. `.pdf` or `.exe`): Must reject with HTTP 400 and clear error message.
2. File size exceeding 5MB: Must reject with HTTP 413 / 400 error.
3. Uploaded image URL served correctly: Must return a valid URL accessible via GET `/static/uploads/candidates/{filename}`.
4. Fallback when `photo_url` is null: Candidate cards must continue displaying the two-letter initials badge gracefully.
5. Removal of selected photo before submission: Clearing the uploaded photo resets the state to empty and removes the preview.

---

### Task 1: Backend Static File Mounting and Candidate Photo Upload Endpoint

**Files:**
- Create: `backend/app/api/v1/uploads.py`
- Modify: `backend/app/api/v1/router.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_candidate_photo_upload.py`

**Steps:**
- [x] Write failing backend tests in `backend/tests/test_candidate_photo_upload.py` testing image upload validation (valid image returns `{ "photo_url": "..." }`, invalid mime type returns 400, oversize returns error).
- [x] Run pytest to confirm test failure.
- [x] Implement `POST /api/v1/uploads/candidate-photo` in `backend/app/api/v1/uploads.py` with validation and disk storage in `backend/static/uploads/candidates/`.
- [x] Mount `/static` with `StaticFiles` in `backend/app/main.py` and register the uploads router in `backend/app/api/v1/router.py`.
- [x] Run pytest to verify all tests in `backend/tests/test_candidate_photo_upload.py` pass.
- [x] Verify existing backend test suite (`backend/tests`) passes without regressions.

---

### Task 2: Frontend API Client and Candidate Photo Upload Component

**Files:**
- Modify: `frontend/src/lib/api-client.ts`
- Create: `frontend/src/components/admin/CandidatePhotoUpload.tsx`
- Test: `frontend/src/test/candidate-photo-upload.test.tsx`

**Steps:**
- [x] Write failing component tests in `frontend/src/test/candidate-photo-upload.test.tsx` testing the `CandidatePhotoUpload` component (renders empty state, accepts file upload, triggers `apiClient.uploadCandidatePhoto`, displays preview, and allows removing photo).
- [x] Run vitest to confirm test failure.
- [x] Add `uploadCandidatePhoto(file: File): Promise<{ photo_url: string }>` to `apiClient` in `frontend/src/lib/api-client.ts`.
- [x] Implement `CandidatePhotoUpload` in `frontend/src/components/admin/CandidatePhotoUpload.tsx` with circular preview, file input trigger, loading spinner, error display, and remove button.
- [x] Run vitest to confirm component tests pass.

---

### Task 3: Integrate Photo Upload into Admin Dashboard and Election Detail Pages

**Files:**
- Modify: `frontend/src/pages/AdminDashboardPage.tsx`
- Modify: `frontend/src/pages/ElectionDetailPage.tsx`
- Test: `frontend/src/test/admin-dashboard-functional.test.tsx`
- Test: `frontend/src/test/elections-pages.test.tsx`

**Steps:**
- [x] Update `frontend/src/pages/AdminDashboardPage.tsx` to include `CandidatePhotoUpload` in the Add Candidate modal, bind `candPhotoUrl`, and render candidate photos on candidate cards in Tab 4.
- [x] Update `frontend/src/pages/ElectionDetailPage.tsx` to include `CandidatePhotoUpload` in the New Candidate form, bind `candidateForm.photo_url`, and render candidate photos on candidate cards in Tab 3.
- [x] Add tests in `frontend/src/test/elections-pages.test.tsx` and `frontend/src/test/admin-dashboard-functional.test.tsx` asserting candidate photo rendering and upload interaction.
- [x] Run `npm --prefix frontend test` to verify all frontend tests pass cleanly.
