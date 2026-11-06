import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RegisterPage } from "../pages/RegisterPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { apiClient } from "../lib/api-client";
import type { User } from "../types/auth";

describe("RegisterPage Institution Flow & Email Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders institution registration form with password requirements helper text", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Register Your Institution|Create an Account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Register Institution$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Northwestern Polytechnic University/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/admin@university\.edu/i)).toBeInTheDocument();
    expect(screen.getByText(/Must be at least 8 characters/i)).toBeInTheDocument();
  });

  it("displays clear inline error when passwords do not match", async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    const passwordInput = screen.getByPlaceholderText(/^Enter your password$/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/^Re-enter your password$/i);

    fireEvent.change(passwordInput, { target: { value: "SecretPassword123!" } });
    fireEvent.change(confirmPasswordInput, { target: { value: "DifferentPassword123!" } });

    expect(await screen.findByText(/Passwords do not match/i)).toBeInTheDocument();
  });

  it("enforces terms and privacy agreement checkbox before submission", async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "John" } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "Doe" } });
    fireEvent.change(screen.getByPlaceholderText(/admin@university\.edu/i), {
      target: { value: "admin@university.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Northwestern Polytechnic University/i), {
      target: { value: "Northwestern University" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /^Register Institution$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/You must agree to the Terms of Service and Privacy Policy/i)).toBeInTheDocument();
  });

  it("enforces institution name before submission", async () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "John" } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "Doe" } });
    fireEvent.change(screen.getByPlaceholderText(/admin@university\.edu/i), {
      target: { value: "admin@university.edu" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    const submitBtn = screen.getByRole("button", { name: /^Register Institution$/i });
    fireEvent.submit(submitBtn.closest("form")!);

    expect(await screen.findByText(/Enter your institution name/i)).toBeInTheDocument();
  });

  it("trims fields and calls apiClient.register and redirects to /dashboard", async () => {
    const registerSpy = vi
      .spyOn(apiClient, "register")
      .mockResolvedValueOnce({
        id: "user-inst-123",
        email: "admin@university.edu",
        display_name: "John Doe",
        email_verified: true,
        account_status: "active",
        account_type: "institution",
        is_platform_admin: false,
        created_at: new Date().toISOString(),
      });

    render(
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard Page</div>} />
        </Routes>
      </MemoryRouter>
    );

    // Enter fields with extra whitespace
    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "   John   " } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "   Doe   " } });
    fireEvent.change(screen.getByPlaceholderText(/admin@university\.edu/i), {
      target: { value: "  ADMIN@UNIVERSITY.EDU  " },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Northwestern Polytechnic University/i), {
      target: { value: "  Northwestern University  " },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });

    // Check terms
    const termsCheckbox = screen.getByRole("checkbox");
    fireEvent.click(termsCheckbox);

    // Submit
    const submitBtn = screen.getByRole("button", { name: /^Register Institution$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerSpy).toHaveBeenCalledWith({
        account_type: "institution",
        first_name: "John",
        last_name: "Doe",
        email: "admin@university.edu",
        institution_name: "Northwestern University",
        institution_type: "University",
        country: "United States",
        password: "SecretPassword123!",
        terms_accepted: true,
      });
    });

    // Should transition to dashboard
    expect(await screen.findByTestId("dashboard-page")).toBeInTheDocument();
  });

  it("displays error with sign-in link when email already exists", async () => {
    vi.spyOn(apiClient, "register").mockRejectedValueOnce(
      new Error("An account with this email address already exists.")
    );

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "John" } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "Doe" } });
    fireEvent.change(screen.getByPlaceholderText(/admin@university\.edu/i), {
      target: { value: "existing@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/e\.g\. Northwestern Polytechnic University/i), {
      target: { value: "Existing University" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^Register Institution$/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Sign in to your existing account/i })).toHaveAttribute("href", "/login");
  });

  it("VerifyEmailPage links verified personal account to /onboarding/personal", async () => {
    const mockPersonalUser: User = {
      id: "user-personal-1",
      email: "verified@example.com",
      display_name: "Verified Personal",
      email_verified: true,
      account_status: "active",
      account_type: "personal",
      is_platform_admin: false,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(apiClient, "verifyEmail").mockResolvedValueOnce(mockPersonalUser);

    render(
      <MemoryRouter initialEntries={["/verify-email?token=valid-personal-token"]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Email Verified Successfully/i)).toBeInTheDocument();
    const continueBtn = screen.getByRole("link", { name: /Continue to Onboarding|Get Started/i });
    expect(continueBtn).toHaveAttribute("href", "/onboarding/personal");
  });

  it("VerifyEmailPage links verified institutional account to /elections", async () => {
    const mockInstitutionUser: User = {
      id: "user-inst-1",
      email: "verified@institution.edu",
      display_name: "Verified Inst",
      email_verified: true,
      account_status: "active",
      account_type: "institution",
      is_platform_admin: false,
      created_at: new Date().toISOString(),
    };

    vi.spyOn(apiClient, "verifyEmail").mockResolvedValueOnce(mockInstitutionUser);

    render(
      <MemoryRouter initialEntries={["/verify-email?token=valid-inst-token"]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText(/Email Verified Successfully/i)).toBeInTheDocument();
    const electionsLink = screen.getByRole("link", { name: /View Eligible Elections/i });
    expect(electionsLink).toHaveAttribute("href", "/elections");
  });
});
