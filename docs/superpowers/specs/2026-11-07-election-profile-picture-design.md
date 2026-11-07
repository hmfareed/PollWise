# Election Circular Profile Picture Feature Specification

## 1. Intent & Purpose
Allow institution election administrators to upload a custom circular profile picture (logo/crest/emblem) for each election. The profile picture will replace the generic blue vote icon next to the election title on the voter landing page (and across institutional admin/voter views), giving elections an authentic institutional identity.

---

## 2. Requirements & Visual Design

### 2.1 Voter Portal Presentation
- **Placement**: Next to the election title in `VoterLandingStep.tsx` and in the voting booth header bar.
- **Geometry**: Circular profile picture (`w-12 h-12 rounded-full object-cover border border-slate-200 shadow-xs bg-slate-50`).
- **Graceful Fallback**: If `photo_url` is null/empty or the image fails to load (error fallback), render a circular blue icon container (`w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-[#0055FF] flex items-center justify-center`).

### 2.2 Administrator Experience
- **Create Election Wizard (Step 1: Details)**:
  - Add an Election Profile Picture uploader with circular preview (`w-20 h-20 rounded-full`).
  - Supports drag & drop / click to upload (PNG, JPG, WebP, GIF, up to 5MB).
  - Immediate local object URL preview, upload progress spinner, and one-click remove button.
- **Election Detail Page (Admin Console)**:
  - Header displays the circular election profile picture.
  - Hover or edit button allows updating/replacing or removing the election profile picture.

---

## 3. Architecture & Data Flow

### 3.1 Backend
1. **Database Schema (`backend/app/models/election.py`)**:
   - Add `photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)` to `Election`.
2. **Pydantic Schemas (`backend/app/schemas/election.py`)**:
   - `CreateElectionRequest`: add `photo_url: str | None = None`.
   - `UpdateElectionRequest`: add `photo_url: str | None = None`.
   - `ElectionResponse` and `ElectionDetailResponse`: include `photo_url: str | None = None`.
3. **Upload Endpoint (`backend/app/api/v1/uploads.py`)**:
   - Add `POST /api/v1/uploads/election-photo` endpoint storing files to `static/uploads/elections/{uuid}.{ext}` with 5MB validation and strict MIME type enforcement.

### 3.2 Frontend
1. **Type Definitions (`frontend/src/types/election.ts`)**:
   - Update `Election` interface: add `photo_url?: string | null`.
2. **API Client (`frontend/src/lib/api-client.ts`)**:
   - Add `uploadElectionPhoto(file: File): Promise<{ photo_url: string }>`.
   - Update `createElection` and `updateElection` payload typings.
3. **Components**:
   - `ElectionPhotoUpload.tsx`: Circular upload component matching PollWise design language.
   - `CreateElectionWizardPage.tsx`: Step 1 integration.
   - `ElectionDetailPage.tsx`: Header circular display & edit action.
   - `VoterLandingStep.tsx`: Circular profile picture display with image error handling.
   - `VotingBoothPage.tsx`: Pass `election.photo_url` to `VoterLandingStep` and display in standalone booth header.

---

## 4. Alternative Approaches Considered
- **Square Tile with rounded-xl**: Matches the previous box geometry, but the user explicitly requested a "circular pfp" for natural profile identity.
- **Banner / Cover Artwork**: Wide cover image above the title, but this consumes excessive vertical space and conflicts with keeping items above the fold on laptop screens.
- **Circular Profile Picture (Selected)**: 1:1 circular avatar, compact, clean, matches institutional crests/avatars and voter expectations.

---

## 5. Verification Plan
- **Backend Tests**:
  - Test `/api/v1/uploads/election-photo` upload and static file serving.
  - Test election creation and update with `photo_url`.
- **Frontend Tests**:
  - Unit tests for `ElectionPhotoUpload` component.
  - `voting-booth-flow.test.tsx` verifying election circular pfp rendering and fallback.
  - `elections-pages.test.tsx` verifying wizard upload and detail page rendering.
  - Full suite verification (`npm --prefix frontend test`).
  - Production build verification (`npx --prefix frontend vite build frontend`).
