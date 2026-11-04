import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CandidatePhotoUpload } from "../components/admin/CandidatePhotoUpload";
import { apiClient } from "../lib/api-client";

describe("CandidatePhotoUpload Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state with upload prompt", () => {
    render(<CandidatePhotoUpload value="" onChange={vi.fn()} />);

    expect(screen.getByText(/upload candidate photo/i)).toBeInTheDocument();
    expect(screen.getByText(/PNG, JPG, WebP or GIF up to 5MB/i)).toBeInTheDocument();
  });

  it("renders existing photo preview when value is provided", () => {
    render(
      <CandidatePhotoUpload
        value="/static/uploads/candidates/sample.png"
        onChange={vi.fn()}
      />
    );

    const img = screen.getByRole("img", { name: /candidate preview/i });
    expect(img).toHaveAttribute("src", "http://localhost:8000/static/uploads/candidates/sample.png");
    expect(screen.getByRole("button", { name: /remove photo/i })).toBeInTheDocument();
  });

  it("gracefully falls back to camera placeholder on image load error", () => {
    render(
      <CandidatePhotoUpload
        value="/static/uploads/candidates/corrupt.png"
        onChange={vi.fn()}
      />
    );

    const img = screen.getByRole("img", { name: /candidate preview/i });
    fireEvent.error(img);

    // Broken image element is hidden so cut-off alt text does not show in circle
    expect(screen.queryByRole("img", { name: /candidate preview/i })).not.toBeInTheDocument();
  });

  it("creates instant local blob preview when file is selected", async () => {
    const mockCreateObjectURL = vi.fn().mockReturnValue("blob:http://localhost:5173/mock-uuid");
    globalThis.URL.createObjectURL = mockCreateObjectURL;
    globalThis.URL.revokeObjectURL = vi.fn();

    vi.spyOn(apiClient, "uploadCandidatePhoto").mockReturnValue(new Promise(() => {})); // pending

    const { container } = render(
      <CandidatePhotoUpload value="" onChange={vi.fn()} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["bytes"], "portrait.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // Instantly renders local blob preview before upload finishes
    const img = await screen.findByRole("img", { name: /candidate preview/i });
    expect(img).toHaveAttribute("src", "blob:http://localhost:5173/mock-uuid");
  });

  it("handles successful file upload", async () => {
    const mockOnChange = vi.fn();
    vi.spyOn(apiClient, "uploadCandidatePhoto").mockResolvedValueOnce({
      photo_url: "/static/uploads/candidates/new-pic.png",
    });

    const { container } = render(
      <CandidatePhotoUpload value="" onChange={mockOnChange} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(["dummy image"], "avatar.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(apiClient.uploadCandidatePhoto).toHaveBeenCalledWith(file);
      expect(mockOnChange).toHaveBeenCalledWith("/static/uploads/candidates/new-pic.png");
    });
  });

  it("rejects non-image files and displays an error", async () => {
    const mockOnChange = vi.fn();
    const spy = vi.spyOn(apiClient, "uploadCandidatePhoto");

    const { container } = render(
      <CandidatePhotoUpload value="" onChange={mockOnChange} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const badFile = new File(["text content"], "document.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [badFile] } });

    expect(await screen.findByText(/only image files/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("rejects files larger than 5MB", async () => {
    const mockOnChange = vi.fn();
    const spy = vi.spyOn(apiClient, "uploadCandidatePhoto");

    const { container } = render(
      <CandidatePhotoUpload value="" onChange={mockOnChange} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    // Create oversized file mock
    const largeFile = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(largeFile, "size", { value: 6 * 1024 * 1024 });

    fireEvent.change(fileInput, { target: { files: [largeFile] } });

    expect(await screen.findByText(/file size exceeds 5mb/i)).toBeInTheDocument();
    expect(spy).not.toHaveBeenCalled();
    expect(mockOnChange).not.toHaveBeenCalled();
  });

  it("clears photo when remove button is clicked", () => {
    const mockOnChange = vi.fn();
    render(
      <CandidatePhotoUpload
        value="/static/uploads/candidates/existing.png"
        onChange={mockOnChange}
      />
    );

    const removeBtn = screen.getByRole("button", { name: /remove photo/i });
    fireEvent.click(removeBtn);

    expect(mockOnChange).toHaveBeenCalledWith("");
  });
});
