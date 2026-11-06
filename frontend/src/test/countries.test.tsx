import { describe, it, expect } from "vitest";
import { ALL_COUNTRIES } from "../lib/countries";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { RegisterPage } from "../pages/RegisterPage";

describe("ALL_COUNTRIES world country list", () => {
  it("contains all sovereign states and over 190 recognized countries", () => {
    expect(ALL_COUNTRIES.length).toBeGreaterThan(190);
    expect(ALL_COUNTRIES).toContain("United States");
    expect(ALL_COUNTRIES).toContain("United Kingdom");
    expect(ALL_COUNTRIES).toContain("Canada");
    expect(ALL_COUNTRIES).toContain("Nigeria");
    expect(ALL_COUNTRIES).toContain("Ghana");
    expect(ALL_COUNTRIES).toContain("Japan");
    expect(ALL_COUNTRIES).toContain("Brazil");
    expect(ALL_COUNTRIES).toContain("Australia");
    expect(ALL_COUNTRIES).toContain("Germany");
    expect(ALL_COUNTRIES).toContain("France");
    expect(ALL_COUNTRIES).toContain("India");
    expect(ALL_COUNTRIES).toContain("Singapore");
    expect(ALL_COUNTRIES).toContain("Egypt");
    expect(ALL_COUNTRIES).toContain("Other");
  });

  it("renders all countries in the RegisterPage country dropdown", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const selects = screen.getAllByRole("combobox");
    const countrySelect = selects[1]; // Second combobox is Country
    const options = countrySelect.querySelectorAll("option");
    const optionValues = Array.from(options).map((o) => o.textContent);

    expect(optionValues).toContain("Afghanistan");
    expect(optionValues).toContain("Brazil");
    expect(optionValues).toContain("Canada");
    expect(optionValues).toContain("Japan");
    expect(optionValues).toContain("Nigeria");
    expect(optionValues).toContain("United Kingdom");
    expect(optionValues).toContain("United States");
    expect(optionValues).toContain("Zimbabwe");
    expect(optionValues).toContain("Other");
  });
});
