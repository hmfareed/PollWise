import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HomePage } from "../pages/HomePage";

describe("HomePage Component", () => {
  it("renders hero title and core action links", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Secure, Verifiable Institutional Elections/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Browse Active Elections/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Administrator Console/i })
    ).toBeInTheDocument();
  });

  it("renders key architectural security pillars", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", { name: /Strict Ballot Secrecy/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Election Lifecycle Control/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Separation of Duties/i })
    ).toBeInTheDocument();
  });
});
