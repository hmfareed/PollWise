import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatusBadge } from "../components/ui/status-badge";

describe("UI Primitives", () => {
  it("renders Button with text and handles default variant", () => {
    render(<Button>Submit Vote</Button>);
    const button = screen.getByRole("button", { name: /Submit Vote/i });
    expect(button).toBeInTheDocument();
  });

  it("renders Badge correctly", () => {
    render(<Badge variant="success">Active</Badge>);
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("renders StatusBadge with state label", () => {
    render(<StatusBadge status="open" />);
    expect(screen.getByText(/Active \/ Open/i)).toBeInTheDocument();
  });
});
