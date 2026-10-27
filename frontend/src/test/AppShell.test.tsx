import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "../layouts/AppShell";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("AppShell Component", () => {
  it("renders brand logo and navigation links", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppShell />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByText("Pollwise")).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Elections")).toBeInTheDocument();
    expect(screen.getByText("Institutional Admin")).toBeInTheDocument();
  });
});
