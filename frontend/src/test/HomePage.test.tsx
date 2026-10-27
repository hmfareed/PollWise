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
      screen.getByText(/Secure Elections for/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Stronger Institutions/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Get Started Free/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Watch Demo/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start Voting/i })
    ).toBeInTheDocument();
  });

  it("renders key architectural security pillars", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Secure by Design/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/For All Institutions/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Transparent Process/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Built for Efficiency/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Global Ready/i)
    ).toBeInTheDocument();
  });

  it("renders Why PollWise section and dashboard mockup preview", () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/More than just a vote/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Manage multiple elections and positions/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Welcome back, Admin/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Explore All Features/i })
    ).toBeInTheDocument();
  });
});
