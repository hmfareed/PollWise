# Election Circular Profile Picture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow administrators to upload a circular profile picture for each election, and display it across the voter portal (landing page & booth header) and administrative consoles with graceful fallback to a circular vote icon.

**Architecture:** Add `photo_url` column to the `elections` table and schemas; create a dedicated `/api/v1/uploads/election-photo` endpoint storing files under `static/uploads/elections/`; integrate `ElectionPhotoUpload` into the Create Election Wizard and Election Detail Page; render the circular image in `VoterLandingStep` and `VotingBoothPage` with error fallback to the blue vote badge.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, React 19, TypeScript, Tailwind CSS v4, Vitest, Pytest.

**Spec:** `docs/superpowers/specs/2026-11-07-election-profile-picture-design.md`

## Global Constraints
- Profile picture is circular (`rounded-full`, 1:1 aspect ratio, `object-cover`).
- Max upload file size is 5MB; permitted types are PNG, JPEG, JPG, WebP, GIF.
- If no picture is uploaded or the image fails to load, gracefully fallback to a circular blue vote icon without layout shifting.
- Secret ballot submission and voter participation flow invariants must remain completely untouched.
- Right half of voter portal must remain pure light theme (`bg-white text-slate-900`).

## Review Focus
1. **Broken image URL fallback**: If an election's `photo_url` points to a 404 or fails to load, `VoterLandingStep` must cleanly fallback to the circular blue vote icon instead of displaying an ugly broken image glyph.
2. **Empty or omitted photo on creation**: An admin creating an election without uploading a photo must succeed with `photo_url: null`.
3. **Removing an existing photo**: An admin removing a photo during edit must set `photo_url: null` and revert to the fallback icon immediately.
4. **Oversized or invalid file types**: File upload must reject non-images or files >5MB with an inline user-friendly error message.
5. **Static asset path resolution**: Stored URLs (e.g. `/static/uploads/elections/abc.png`) must resolve properly in both production and development environments via `getAssetUrl()`.

---

### Task 1: Backend Database Model & Schemas for Election `photo_url`

**Files:**
- Modify: `backend/app/models/election.py:50-70`
- Modify: `backend/app/schemas/election.py:8-35,150-175`
- Modify: `backend/app/api/v1/elections.py:100-140,250-290`
- Test: `backend/tests/test_election_photo.py`

**Interfaces:**
- Consumes: SQLAlchemy `Election` model and FastAPI routers.
- Produces: `photo_url: str | None` field on `Election`, `CreateElectionRequest`, `UpdateElectionRequest`, and `ElectionResponse`.

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_election_photo.py
import pytest
from httpx import AsyncClient
import uuid

@pytest.mark.asyncio
async def test_election_create_and_update_with_photo_url(test_client: AsyncClient):
    # Register & Login
    email = f"photo_admin_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post("/api/v1/auth/register", json={"email": email, "password": "Password123!", "display_name": "Org Admin"})
    await test_client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})
    
    # Get organization
    orgs_res = await test_client.get("/api/v1/organizations")
    org_id = orgs_res.json()["data"][0]["id"]

    # Create election with photo_url
    create_res = await test_client.post(
        "/api/v1/elections",
        json={
            "organization_id": org_id,
            "title": "Photo Test Election",
            "description": "Testing photo url",
            "photo_url": "/static/uploads/elections/test.png",
        },
    )
    assert create_res.status_code == 201
    election = create_res.json()["data"]
    assert election["photo_url"] == "/static/uploads/elections/test.png"

    # Update election photo_url to None
    elec_id = election["id"]
    patch_res = await test_client.patch(
        f"/api/v1/elections/{elec_id}",
        json={"photo_url": None},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["data"]["photo_url"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_election_photo.py -v`
Expected: FAIL (field `photo_url` does not exist on schema/model)

- [ ] **Step 3: Implement `photo_url` in model, schemas, and API**
  - In `backend/app/models/election.py`: add `photo_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)` to `Election`.
  - In `backend/app/schemas/election.py`: add `photo_url: str | None = None` to `CreateElectionRequest`, `UpdateElectionRequest`, `ElectionResponse`, and `ElectionDetailResponse`.
  - In `backend/app/api/v1/elections.py`: assign `photo_url` in `create_election` and `update_election`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_election_photo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/election.py backend/app/schemas/election.py backend/app/api/v1/elections.py backend/tests/test_election_photo.py
git commit -m "feat(backend): add photo_url to Election model and schemas"
```

---

### Task 2: Backend Upload Endpoint for Election Photos

**Files:**
- Modify: `backend/app/api/v1/uploads.py:20-80`
- Test: `backend/tests/test_election_photo.py`

**Interfaces:**
- Consumes: FastAPI `UploadFile`, `get_current_user` dependency.
- Produces: `POST /api/v1/uploads/election-photo` returning `{"photo_url": "/static/uploads/elections/{uuid}.{ext}"}`.

- [ ] **Step 1: Write the failing test**

```python
# In backend/tests/test_election_photo.py
@pytest.mark.asyncio
async def test_upload_election_photo(test_client: AsyncClient):
    email = f"photo_uploader_{uuid.uuid4().hex[:6]}@pollwise.edu"
    await test_client.post("/api/v1/auth/register", json={"email": email, "password": "Password123!", "display_name": "Uploader"})
    await test_client.post("/api/v1/auth/login", json={"email": email, "password": "Password123!"})

    fake_png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    files = {"file": ("election_logo.png", io.BytesIO(fake_png), "image/png")}
    res = await test_client.post("/api/v1/uploads/election-photo", files=files)
    assert res.status_code == 201
    photo_url = res.json()["data"]["photo_url"]
    assert photo_url.startswith("/static/uploads/elections/")
    assert photo_url.endswith(".png")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest backend/tests/test_election_photo.py::test_upload_election_photo -v`
Expected: FAIL (404 Not Found for `/api/v1/uploads/election-photo`)

- [ ] **Step 3: Implement `/api/v1/uploads/election-photo` endpoint in `backend/app/api/v1/uploads.py`**
  - Define `ELECTION_UPLOAD_DIR = Path(__file__).resolve().parents[3] / "static" / "uploads" / "elections"`.
  - Validate file extension, MIME type, and 5MB limit.
  - Save asynchronously to `ELECTION_UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"`.
  - Return `ApiResponse(data={"photo_url": f"/static/uploads/elections/{safe_filename}"})`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest backend/tests/test_election_photo.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/v1/uploads.py backend/tests/test_election_photo.py
git commit -m "feat(backend): add /api/v1/uploads/election-photo endpoint"
```

---

### Task 3: Frontend Types & API Client Support

**Files:**
- Modify: `frontend/src/types/election.ts:20-40`
- Modify: `frontend/src/lib/api-client.ts:350-380`
- Test: `frontend/src/test/api-client-personal.test.ts`

**Interfaces:**
- Consumes: API endpoints `/api/v1/uploads/election-photo`, `/api/v1/elections`.
- Produces: `Election.photo_url?: string | null`, `apiClient.uploadElectionPhoto(file: File)`.

- [ ] **Step 1: Write the failing test**

```typescript
// In frontend/src/test/api-client-personal.test.ts
it("calls uploadElectionPhoto and returns photo_url", async () => {
  const fakeFile = new File(["dummy"], "pfp.png", { type: "image/png" });
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { photo_url: "/static/uploads/elections/logo.png" } }),
  });
  const res = await apiClient.uploadElectionPhoto(fakeFile);
  expect(res.photo_url).toBe("/static/uploads/elections/logo.png");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/api-client-personal.test.ts`
Expected: FAIL (`uploadElectionPhoto` is not a function)

- [ ] **Step 3: Implement types and API client method**
  - Add `photo_url?: string | null;` to `Election` in `frontend/src/types/election.ts`.
  - Add `uploadElectionPhoto` to `apiClient` in `frontend/src/lib/api-client.ts` matching `uploadCandidatePhoto` pattern.
  - Update `createElection` and `updateElection` payload parameters in `apiClient`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/api-client-personal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/election.ts frontend/src/lib/api-client.ts frontend/src/test/api-client-personal.test.ts
git commit -m "feat(frontend): add photo_url to Election interface and uploadElectionPhoto to apiClient"
```

---

### Task 4: Frontend `ElectionPhotoUpload` Component

**Files:**
- Create: `frontend/src/components/admin/ElectionPhotoUpload.tsx`
- Test: `frontend/src/test/election-photo-upload.test.tsx`

**Interfaces:**
- Consumes: `apiClient.uploadElectionPhoto`, `getAssetUrl`.
- Produces: `<ElectionPhotoUpload value={photoUrl} onChange={setPhotoUrl} disabled={...} />` rendering a circular profile picture preview.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/test/election-photo-upload.test.tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ElectionPhotoUpload } from "../components/admin/ElectionPhotoUpload";
import { apiClient } from "../lib/api-client";

describe("ElectionPhotoUpload Component", () => {
  it("renders circular upload area and handles image selection and upload", async () => {
    const onChange = vi.fn();
    vi.spyOn(apiClient, "uploadElectionPhoto").mockResolvedValue({
      photo_url: "/static/uploads/elections/circ.png",
    });

    render(<ElectionPhotoUpload value={null} onChange={onChange} />);
    expect(screen.getByText(/Upload Election Photo/i)).toBeInTheDocument();

    const file = new File(["dummy"], "circ.png", { type: "image/png" });
    const input = screen.getByLabelText(/Upload Election Photo/i, { selector: "input" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith("/static/uploads/elections/circ.png");
    });
  });

  it("renders existing photo in circular preview and handles remove", () => {
    const onChange = vi.fn();
    render(<ElectionPhotoUpload value="/static/uploads/elections/circ.png" onChange={onChange} />);
    const removeBtn = screen.getByRole("button", { name: /remove photo/i });
    fireEvent.click(removeBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/election-photo-upload.test.tsx`
Expected: FAIL (Component does not exist)

- [ ] **Step 3: Implement `ElectionPhotoUpload.tsx`**
  - Circular avatar preview (`w-20 h-20 rounded-full object-cover border-2 border-slate-200 shadow-xs`).
  - Dropzone/click upload with Camera/Upload icon.
  - MIME check (PNG, JPG, WebP, GIF) and size check (5MB).
  - Clear remove button with Trash icon and accessible label.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/election-photo-upload.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/admin/ElectionPhotoUpload.tsx frontend/src/test/election-photo-upload.test.tsx
git commit -m "feat(frontend): create circular ElectionPhotoUpload component"
```

---

### Task 5: Admin UI Integration (Create Wizard & Detail Page)

**Files:**
- Modify: `frontend/src/pages/CreateElectionWizardPage.tsx:160-220,360-400,600-680`
- Modify: `frontend/src/pages/ElectionDetailPage.tsx:120-170,250-320`
- Test: `frontend/src/test/elections-pages.test.tsx`

**Interfaces:**
- Consumes: `<ElectionPhotoUpload />`, `apiClient.createElection`, `apiClient.updateElection`.
- Produces: Integrated election creation and editing with circular photo support.

- [ ] **Step 1: Write the failing test**

```tsx
// In frontend/src/test/elections-pages.test.tsx
it("renders circular election photo upload in CreateElectionWizardPage Step 1", async () => {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/elections/new"]}>
        <CreateElectionWizardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
  expect(await screen.findByText(/Election Profile Picture/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/elections-pages.test.tsx`
Expected: FAIL ("Election Profile Picture" not found)

- [ ] **Step 3: Integrate photo upload in Create Wizard & Detail Page**
  - In `CreateElectionWizardPage.tsx`: Add `photoUrl` state, render `<ElectionPhotoUpload value={photoUrl} onChange={setPhotoUrl} />` in Step 1, pass `photo_url: photoUrl.trim() || undefined` in `createElection`.
  - In `ElectionDetailPage.tsx`: Display circular election profile picture in header (`w-14 h-14 rounded-full object-cover border border-slate-200`) or fallback icon, and allow changing it in settings or modal.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/elections-pages.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CreateElectionWizardPage.tsx frontend/src/pages/ElectionDetailPage.tsx frontend/src/test/elections-pages.test.tsx
git commit -m "feat(frontend): integrate circular election photo in wizard and detail page"
```

---

### Task 6: Voter Portal Circular PFP Presentation with Fallback

**Files:**
- Modify: `frontend/src/components/voter/VoterLandingStep.tsx:13-75`
- Modify: `frontend/src/pages/VotingBoothPage.tsx:340-365,430-460`
- Test: `frontend/src/test/voting-booth-flow.test.tsx`

**Interfaces:**
- Consumes: `election.photo_url`, `getAssetUrl`.
- Produces: Circular profile picture in `VoterLandingStep` and booth header with image error fallback.

- [ ] **Step 1: Write the failing test**

```tsx
// In frontend/src/test/voting-booth-flow.test.tsx
it("renders circular election profile picture when photo_url is provided and falls back on error", async () => {
  // Mock election with photo_url
  vi.spyOn(apiClient, "getElection").mockResolvedValueOnce({
    ...mockElection,
    photo_url: "/static/uploads/elections/src-test.png",
  });
  renderVotingBooth();
  const img = await screen.findByAltText(/SRC TEST logo/i);
  expect(img).toHaveClass("rounded-full");
  expect(img).toHaveAttribute("src", expect.stringContaining("/static/uploads/elections/src-test.png"));

  // Trigger error fallback
  fireEvent.error(img);
  // Expect fallback circular Vote icon
  expect(screen.queryByAltText(/SRC TEST logo/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix frontend test -- --run src/test/voting-booth-flow.test.tsx`
Expected: FAIL (`img` not found with alt text)

- [ ] **Step 3: Implement circular PFP in VoterLandingStep and VotingBoothPage**
  - Add `electionPhotoUrl?: string | null;` to `VoterLandingStepProps`.
  - Maintain `imageError` state: if `electionPhotoUrl && !imageError`, render:
    ```tsx
    <img
      src={getAssetUrl(electionPhotoUrl)}
      alt={`${electionTitle} logo`}
      onError={() => setImageError(true)}
      className="w-12 h-12 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs bg-slate-50"
    />
    ```
  - If no photo or on error, render:
    ```tsx
    <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-100 text-[#0055FF] flex items-center justify-center shrink-0 shadow-xs">
      <Vote className="w-6 h-6" />
    </div>
    ```
  - In `VotingBoothPage.tsx`: pass `electionPhotoUrl={election.photo_url}` to `VoterLandingStep`, and in the top header bar render the circular PFP next to the title.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix frontend test -- --run src/test/voting-booth-flow.test.tsx src/test/access-code-voting.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/voter/VoterLandingStep.tsx frontend/src/pages/VotingBoothPage.tsx frontend/src/test/voting-booth-flow.test.tsx
git commit -m "feat(voter): render circular election profile picture with graceful fallback"
```

---

### Task 7: Full Verification & Production Build

- [ ] **Step 1: Run full frontend test suite**
  - `npm --prefix frontend test` (Verify all 30 test files and all tests pass)
- [ ] **Step 2: Run Vite production build**
  - `npx --prefix frontend vite build frontend` (Verify clean bundle compilation)
- [ ] **Step 3: Run backend test suite**
  - `pytest backend/tests/test_election_photo.py -v`
- [ ] **Step 4: Final commit and status clean check**
