import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RegisterPage } from "../pages/RegisterPage";
import { VerifyEmailPage } from "../pages/VerifyEmailPage";
import { apiClient } from "../lib/api-client";
import type { User } from "../types/auth";

describe("RegisterPage Personal Flow & Email Verification", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders personal registration form with password requirements helper text", () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /Create an Account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Create Personal Account$/i })).toBeInTheDocument();
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
    fireEvent.change(screen.getByPlaceholderText("Enter your email address"), {
      target: { value: "john.doe@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });

    const submitBtn = screen.getByRole("button", { name: /^Create Personal Account$/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/You must agree to the Terms of Service and Privacy Policy/i)).toBeInTheDocument();
  });

  it("trims fields and calls apiClient.registerPersonal for personal accounts", async () => {
    const registerPersonalSpy = vi
      .spyOn(apiClient, "registerPersonal")
      .mockResolvedValueOnce({
        id: "user-123",
        email: "john.doe@example.com",
        display_name: "John Doe",
        email_verified: false,
        account_status: "pending_verification",
        account_type: "personal",
        is_platform_admin: false,
        created_at: new Date().toISOString(),
      });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Enter fields with extra whitespace
    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "   John   " } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "   Doe   " } });
    fireEvent.change(screen.getByPlaceholderText("Enter your email address"), {
      target: { value: "  JOHN.DOE@EXAMPLE.COM  " },
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
    const submitBtn = screen.getByRole("button", { name: /^Create Personal Account$/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(registerPersonalSpy).toHaveBeenCalledWith({
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        password: "SecretPassword123!",
        terms_accepted: true,
      });
    });

    // Should transition to Verify Email screen (Section 3.1)
    expect(await screen.findByRole("heading", { name: /^Verify your email address$/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /We sent a verification link to the email address you entered\. Verify your email to activate your Pollwise account\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
    expect(screen.getByText(/spam/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend Verification Email/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Change Email Address/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Return to Sign In/i })).toHaveAttribute("href", "/login");
  });

  it("handles Change Email Address by returning to form with fields intact", async () => {
    vi.spyOn(apiClient, "registerPersonal").mockResolvedValueOnce({
      id: "user-123",
      email: "typo@example.com",
      display_name: "John Doe",
      email_verified: false,
      account_status: "pending_verification",
      account_type: "personal",
      is_platform_admin: false,
      created_at: new Date().toISOString(),
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "John" } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "Doe" } });
    fireEvent.change(screen.getByPlaceholderText("Enter your email address"), {
      target: { value: "typo@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: /^Create Personal Account$/i }));

    // On verification screen
    const changeEmailBtn = await screen.findByRole("button", { name: /Change Email Address/i });
    fireEvent.click(changeEmailBtn);

    // Form should be visible again with previous values intact
    expect(await screen.findByRole("heading", { name: /Create an Account/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Alice")).toHaveValue("John");
    expect(screen.getByPlaceholderText("Smith")).toHaveValue("Doe");
    expect(screen.getByPlaceholderText("Enter your email address")).toHaveValue("typo@example.com");
  });

  it("handles Resend Verification Email and enters cooldown countdown", async () => {
    vi.spyOn(apiClient, "registerPersonal").mockResolvedValueOnce({
      id: "user-123",
      email: "resend.user@example.com",
      display_name: "Resend User",
      email_verified: false,
      account_status: "pending_verification",
      account_type: "personal",
      is_platform_admin: false,
      created_at: new Date().toISOString(),
    });

    const resendSpy = vi.spyOn(apiClient, "resendVerification").mockResolvedValueOnce({
      message: "A fresh verification link has been sent.",
    });

    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText("Alice"), { target: { value: "Resend" } });
    fireEvent.change(screen.getByPlaceholderText("Smith"), { target: { value: "User" } });
    fireEvent.change(screen.getByPlaceholderText("Enter your email address"), {
      target: { value: "resend.user@example.com" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.change(screen.getByPlaceholderText(/^Re-enter your password$/i), {
      target: { value: "SecretPassword123!" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^Create Personal Account$/i }));

    const resendBtn = await screen.findByRole("button", { name: /Resend Verification Email/i });
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith("resend.user@example.com");
    });

    expect(await screen.findByText(/A fresh verification link has been sent/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Resend available in/i })).toBeDisabled();
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
