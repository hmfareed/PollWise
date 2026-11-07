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
    expect(screen.getByText(/Upload Election Logo/i)).toBeInTheDocument();

    const file = new File(["dummy"], "circ.png", { type: "image/png" });
    const input = screen.getByLabelText(/Upload Election Logo/i, { selector: "input" });
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
