import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthContext } from "../features/auth/authContextDef";
import { PersonalOnboardingPage } from "../pages/PersonalOnboardingPage";
import { apiClient } from "../lib/api-client";
import type { User } from "../types/auth";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const mockDefaultUser: User = {
  id: "user-abc-123",
  email: "alice@example.com",
  display_name: "Alice Smith",
  first_name: "Alice",
  last_name: "Smith",
  phone_number: "+1 555-0199",
  country: "United States",
  preferred_language: "English",
  email_verified: true,
  account_status: "active",
  is_platform_admin: false,
  created_at: new Date().toISOString(),
  account_type: "personal",
};

const renderWithProviders = (
  userOverride?: Partial<User>,
  initialEntries = ["/onboarding/personal"]
) => {
  const queryClient = createTestQueryClient();
  const user = { ...mockDefaultUser, ...userOverride };
  const refreshMock = vi.fn().mockResolvedValue(undefined);

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          memberships: [],
          isAuthenticated: true,
          isLoading: false,
          login: vi.fn(),
          register: vi.fn(),
          logout: vi.fn(),
          refresh: refreshMock,
        }}
      >
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/onboarding/personal" element={<PersonalOnboardingPage />} />
            <Route path="/verify-email" element={<div data-testid="verify-email-screen">Verify Email Screen</div>} />
            <Route path="/dashboard" element={<div data-testid="dashboard-screen">Personal Dashboard</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
};

describe("PersonalOnboardingPage Multi-Step Wizard", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unverified user to /verify-email", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 1,
      onboarding_status: "not_started",
    });

    renderWithProviders({ email_verified: false });

    expect(await screen.findByTestId("verify-email-screen")).toBeInTheDocument();
  });

  it("renders Welcome step (Step 1) and navigates to Profile setup on Get Started", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 1,
      onboarding_status: "not_started",
    });

    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockResolvedValueOnce({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: 2,
        onboarding_status: "in_progress",
      });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Welcome to Pollwise/i })).toBeInTheDocument();
    expect(screen.getByText(/Your personal account is ready/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();

    const getStartedBtn = screen.getByRole("button", { name: /Get Started/i });
    fireEvent.click(getStartedBtn);

    await waitFor(() => {
      expect(updateOnboardingSpy).toHaveBeenCalledWith(2, "in_progress");
      expect(screen.getByRole("heading", { name: /Complete Personal Profile/i })).toBeInTheDocument();
    });
  });

  it("resumes onboarding from existing current_step on mount", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 3,
      onboarding_status: "in_progress",
    });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Set Up Account Security/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 3 of 5/i)).toBeInTheDocument();
  });

  it("validates required fields on blur and submission in Step 2", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 2,
      onboarding_status: "in_progress",
    });

    const updateProfileSpy = vi.spyOn(apiClient, "updateProfile").mockResolvedValueOnce({
      ...mockDefaultUser,
      first_name: "Alicia",
      last_name: "Keys",
      display_name: "Alicia Keys",
      phone_number: "+1 555-9999",
      country: "Canada",
      preferred_language: "French",
    });

    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockResolvedValueOnce({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: 3,
        onboarding_status: "in_progress",
      });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Complete Personal Profile/i })).toBeInTheDocument();

    const firstNameInput = screen.getByLabelText(/First Name/i) as HTMLInputElement;
    const lastNameInput = screen.getByLabelText(/Last Name/i) as HTMLInputElement;
    const displayNameInput = screen.getByLabelText(/Display Name/i) as HTMLInputElement;
    const phoneInput = screen.getByLabelText(/Phone Number/i) as HTMLInputElement;

    // Test onBlur validation on empty fields
    fireEvent.change(firstNameInput, { target: { value: "   " } });
    fireEvent.blur(firstNameInput);
    expect(await screen.findByText(/First name is required/i)).toBeInTheDocument();

    fireEvent.change(lastNameInput, { target: { value: "   " } });
    fireEvent.blur(lastNameInput);
    expect(await screen.findByText(/Last name is required/i)).toBeInTheDocument();

    // Fill valid data
    fireEvent.change(firstNameInput, { target: { value: "Alicia" } });
    fireEvent.change(lastNameInput, { target: { value: "Keys" } });
    fireEvent.change(displayNameInput, { target: { value: "Alicia Keys" } });
    fireEvent.change(phoneInput, { target: { value: "+1 555-9999" } });

    fireEvent.click(screen.getByRole("button", { name: /Continue/i }));

    await waitFor(() => {
      expect(updateProfileSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          first_name: "Alicia",
          last_name: "Keys",
          display_name: "Alicia Keys",
          phone_number: "+1 555-9999",
        })
      );
      expect(updateOnboardingSpy).toHaveBeenCalledWith(3, "in_progress");
      expect(screen.getByRole("heading", { name: /Set Up Account Security/i })).toBeInTheDocument();
    });
  });

  it("handles MFA authenticator setup and verification in Step 3", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 3,
      onboarding_status: "in_progress",
    });

    const setupMfaSpy = vi.spyOn(apiClient, "setupMfa").mockResolvedValueOnce({
      secret: "JBSWY3DPEHPK3PXP",
      qr_uri: "otpauth://totp/PollWise:alice@example.com?secret=JBSWY3DPEHPK3PXP",
      recovery_codes: [
        "rc-1111",
        "rc-2222",
        "rc-3333",
        "rc-4444",
        "rc-5555",
        "rc-6666",
        "rc-7777",
        "rc-8888",
      ],
    });

    const verifyMfaSpy = vi.spyOn(apiClient, "verifyMfa").mockResolvedValueOnce({
      message: "MFA verified and enabled successfully.",
      mfa_enabled: true,
    });

    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockResolvedValueOnce({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: 4,
        onboarding_status: "in_progress",
      });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Set Up Account Security/i })).toBeInTheDocument();

    const setupBtn = screen.getByRole("button", { name: /Set Up MFA/i });
    fireEvent.click(setupBtn);

    await waitFor(() => {
      expect(setupMfaSpy).toHaveBeenCalled();
      expect(screen.getByText("JBSWY3DPEHPK3PXP")).toBeInTheDocument();
      expect(screen.getByText("rc-1111")).toBeInTheDocument();
      expect(screen.getByText("rc-8888")).toBeInTheDocument();
    });

    const codeInput = screen.getByPlaceholderText(/123456/i);
    fireEvent.change(codeInput, { target: { value: "654321" } });

    const verifyBtn = screen.getByRole("button", { name: /Verify & Enable/i });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(verifyMfaSpy).toHaveBeenCalledWith("654321");
      expect(updateOnboardingSpy).toHaveBeenCalledWith(4, "in_progress");
      expect(screen.getByRole("heading", { name: /Connect to Your Institution/i })).toBeInTheDocument();
    });
  });

  it("allows skipping MFA in Step 3 via 'Do This Later'", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 3,
      onboarding_status: "in_progress",
    });

    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockResolvedValueOnce({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: 4,
        onboarding_status: "in_progress",
      });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Set Up Account Security/i })).toBeInTheDocument();

    const laterBtn = screen.getByRole("button", { name: /Do This Later/i });
    fireEvent.click(laterBtn);

    await waitFor(() => {
      expect(updateOnboardingSpy).toHaveBeenCalledWith(4, "in_progress");
      expect(screen.getByRole("heading", { name: /Connect to Your Institution/i })).toBeInTheDocument();
    });
  });

  it("validates and accepts an invitation code in Step 4", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 4,
      onboarding_status: "in_progress",
    });

    const validateSpy = vi.spyOn(apiClient, "validateInvitation").mockResolvedValueOnce({
      invitation_code: "CAMPUS-2026",
      institution_id: "inst-101",
      institution_name: "Metropolitan University",
      invitation_type: "student",
    });

    const acceptSpy = vi.spyOn(apiClient, "acceptInvitation").mockResolvedValueOnce({
      message: "Successfully joined Metropolitan University.",
      institution_id: "inst-101",
      institution_name: "Metropolitan University",
    });

    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockImplementation(async (step, status) => ({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: typeof step === "number" ? step : 5,
        onboarding_status: status || "in_progress",
      }));

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Connect to Your Institution/i })).toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText(/Enter invitation code/i);
    fireEvent.change(codeInput, { target: { value: "CAMPUS-2026" } });

    const validateBtn = screen.getByRole("button", { name: /Validate Code/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith("CAMPUS-2026");
      expect(screen.getByText("Metropolitan University")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Confirm & Join/i })).toBeInTheDocument();
    });

    const confirmBtn = screen.getByRole("button", { name: /Confirm & Join/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(acceptSpy).toHaveBeenCalledWith("CAMPUS-2026");
      expect(updateOnboardingSpy).toHaveBeenCalledWith(5, "in_progress");
      expect(screen.getByRole("heading", { name: /You're all set/i })).toBeInTheDocument();
    });
  });

  it("allows skipping institution connection in Step 4 via 'Skip for Now'", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 4,
      onboarding_status: "in_progress",
    });

    const acceptSpy = vi.spyOn(apiClient, "acceptInvitation");
    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockImplementation(async (step, status) => ({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: typeof step === "number" ? step : 5,
        onboarding_status: status || "in_progress",
      }));

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Connect to Your Institution/i })).toBeInTheDocument();

    const skipBtn = screen.getByRole("button", { name: /Skip for Now/i });
    fireEvent.click(skipBtn);

    await waitFor(() => {
      expect(acceptSpy).not.toHaveBeenCalled();
      expect(updateOnboardingSpy).toHaveBeenCalledWith(5, "in_progress");
      expect(screen.getByRole("heading", { name: /You're all set/i })).toBeInTheDocument();
    });
  });

  it("completes onboarding in Step 5 and navigates to /dashboard", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 5,
      onboarding_status: "in_progress",
    });

    const updateOnboardingSpy = vi
      .spyOn(apiClient, "updatePersonalOnboarding")
      .mockResolvedValue({
        id: "onb-1",
        user_id: "user-abc-123",
        current_step: 5,
        onboarding_status: "completed",
      });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /You're all set/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(updateOnboardingSpy).toHaveBeenCalledWith(5, "completed");
    });

    const dashboardBtn = screen.getByRole("button", { name: /Go to My Dashboard/i });
    fireEvent.click(dashboardBtn);

    expect(await screen.findByTestId("dashboard-screen")).toBeInTheDocument();
  });

  it("manages avatar object URL lifecycle: revokes on replacement, removal, and unmount", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 2,
      onboarding_status: "in_progress",
    });

    const createObjectURLMock = vi.fn();
    const revokeObjectURLMock = vi.fn();
    createObjectURLMock
      .mockReturnValueOnce("blob:http://localhost/mock-avatar-1")
      .mockReturnValueOnce("blob:http://localhost/mock-avatar-2");

    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const { unmount } = renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Complete Personal Profile/i })).toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();

    // 1. Upload first photo
    const file1 = new File(["dummy content 1"], "avatar1.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file1] } });

    expect(createObjectURLMock).toHaveBeenCalledWith(file1);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    // 2. Upload second photo -> should revoke first object URL
    const file2 = new File(["dummy content 2"], "avatar2.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [file2] } });

    expect(createObjectURLMock).toHaveBeenCalledWith(file2);
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/mock-avatar-1");

    // 3. Remove photo -> should revoke second object URL
    const removeBtn = screen.getByRole("button", { name: /Remove photo/i });
    fireEvent.click(removeBtn);

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/mock-avatar-2");

    // 4. Upload photo again and unmount -> should revoke active URL on unmount
    createObjectURLMock.mockReturnValueOnce("blob:http://localhost/mock-avatar-3");
    fireEvent.change(fileInput, { target: { files: [file1] } });

    unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:http://localhost/mock-avatar-3");
  });

  it("auto-uppercases and trims invitation code input in Step 4", async () => {
    vi.spyOn(apiClient, "getPersonalOnboarding").mockResolvedValueOnce({
      id: "onb-1",
      user_id: "user-abc-123",
      current_step: 4,
      onboarding_status: "in_progress",
    });

    const validateSpy = vi.spyOn(apiClient, "validateInvitation").mockResolvedValueOnce({
      invitation_code: "CAMPUS-2026",
      institution_id: "inst-101",
      institution_name: "Metropolitan University",
      invitation_type: "student",
    });

    renderWithProviders();

    expect(await screen.findByRole("heading", { name: /Connect to Your Institution/i })).toBeInTheDocument();

    const codeInput = screen.getByPlaceholderText(/Enter invitation code/i) as HTMLInputElement;

    // Type lowercase code with whitespace
    fireEvent.change(codeInput, { target: { value: "  campus-2026  " } });
    expect(codeInput.value).toBe("  CAMPUS-2026  ");

    // Blur trims input value
    fireEvent.blur(codeInput);
    expect(codeInput.value).toBe("CAMPUS-2026");

    const validateBtn = screen.getByRole("button", { name: /Validate Code/i });
    fireEvent.click(validateBtn);

    await waitFor(() => {
      expect(validateSpy).toHaveBeenCalledWith("CAMPUS-2026");
    });
  });
});
