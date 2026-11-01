import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { apiClient } from "../lib/api-client";
import type {
  PersonalRegisterPayload,
  UpdateUserProfilePayload,
} from "../types/auth";

describe("Personal Onboarding API Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defines registerPersonal and onboarding methods", () => {
    expect(typeof apiClient.registerPersonal).toBe("function");
    expect(typeof apiClient.getPersonalOnboarding).toBe("function");
    expect(typeof apiClient.updatePersonalOnboarding).toBe("function");
    expect(typeof apiClient.updateProfile).toBe("function");
    expect(typeof apiClient.setupMfa).toBe("function");
    expect(typeof apiClient.verifyMfa).toBe("function");
    expect(typeof apiClient.validateInvitation).toBe("function");
    expect(typeof apiClient.acceptInvitation).toBe("function");
    expect(typeof apiClient.getMyElections).toBe("function");
  });

  it("calls POST /auth/register/personal with payload", async () => {
    const mockUser = {
      id: "u-1",
      email: "test@example.com",
      display_name: "Test User",
      email_verified: false,
      account_status: "pending_verification",
      is_platform_admin: false,
      created_at: new Date().toISOString(),
      account_type: "personal" as const,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: mockUser }),
    } as Response);

    const payload: PersonalRegisterPayload = {
      first_name: "Test",
      last_name: "User",
      email: "test@example.com",
      password: "Password123!",
      terms_accepted: true,
    };

    const res = await apiClient.registerPersonal(payload);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/auth/register/personal"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify(payload),
      })
    );
    expect(res).toEqual(mockUser);
  });

  it("calls GET /users/me/onboarding", async () => {
    const mockOnboarding = {
      id: "onb-1",
      user_id: "u-1",
      current_step: 1,
      onboarding_status: "not_started",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockOnboarding }),
    } as Response);

    const res = await apiClient.getPersonalOnboarding();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/onboarding"),
      expect.objectContaining({
        credentials: "include",
      })
    );
    expect(res).toEqual(mockOnboarding);
  });

  it("calls PATCH /users/me/onboarding with step and status", async () => {
    const mockOnboarding = {
      id: "onb-1",
      user_id: "u-1",
      current_step: 2,
      onboarding_status: "in_progress",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockOnboarding }),
    } as Response);

    const res = await apiClient.updatePersonalOnboarding(2, "in_progress");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/onboarding"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ current_step: 2, onboarding_status: "in_progress" }),
      })
    );
    expect(res).toEqual(mockOnboarding);
  });

  it("calls PATCH /users/me/onboarding with object payload", async () => {
    const mockOnboarding = {
      id: "onb-1",
      user_id: "u-1",
      current_step: 3,
      onboarding_status: "in_progress",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockOnboarding }),
    } as Response);

    const res = await apiClient.updatePersonalOnboarding({
      current_step: 3,
      onboarding_status: "in_progress",
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/onboarding"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ current_step: 3, onboarding_status: "in_progress" }),
      })
    );
    expect(res).toEqual(mockOnboarding);
  });

  it("calls PATCH /users/me/profile with profile payload", async () => {
    const mockUser = {
      id: "u-1",
      email: "test@example.com",
      display_name: "Updated Name",
      phone_number: "+1234567890",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockUser }),
    } as Response);

    const profileData: UpdateUserProfilePayload = {
      first_name: "Updated",
      last_name: "Name",
      display_name: "Updated Name",
      phone_number: "+1234567890",
      country: "US",
    };

    const res = await apiClient.updateProfile(profileData);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/profile"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify(profileData),
      })
    );
    expect(res).toEqual(mockUser);
  });

  it("calls POST /users/me/mfa/setup", async () => {
    const mockMfa = {
      secret: "JBSWY3DPEHPK3PXP",
      qr_uri: "otpauth://totp/PollWise:test@example.com?secret=JBSWY3DPEHPK3PXP",
      recovery_codes: ["code1", "code2"],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockMfa }),
    } as Response);

    const res = await apiClient.setupMfa();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/mfa/setup"),
      expect.objectContaining({
        method: "POST",
      })
    );
    expect(res).toEqual(mockMfa);
  });

  it("calls POST /users/me/mfa/verify with 6-digit code", async () => {
    const mockResult = {
      message: "MFA verified and enabled successfully.",
      mfa_enabled: true,
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockResult }),
    } as Response);

    const res = await apiClient.verifyMfa("123456");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/mfa/verify"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ code: "123456" }),
      })
    );
    expect(res).toEqual(mockResult);
  });

  it("calls POST /institutions/invitations/validate with invitation code", async () => {
    const mockValidation = {
      invitation_code: "CAMPUS-2026",
      institution_id: "inst-1",
      institution_name: "State University",
      invitation_type: "member",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockValidation }),
    } as Response);

    const res = await apiClient.validateInvitation("CAMPUS-2026");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/institutions/invitations/validate"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ invitation_code: "CAMPUS-2026" }),
      })
    );
    expect(res).toEqual(mockValidation);
  });

  it("calls POST /institutions/invitations/accept with invitation code", async () => {
    const mockAccept = {
      message: "Successfully joined State University.",
      institution_id: "inst-1",
      institution_name: "State University",
      role: "member",
      status: "active",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockAccept }),
    } as Response);

    const res = await apiClient.acceptInvitation("CAMPUS-2026");
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/institutions/invitations/accept"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ invitation_code: "CAMPUS-2026" }),
      })
    );
    expect(res).toEqual(mockAccept);
  });

  it("calls GET /users/me/elections", async () => {
    const mockElections = [
      {
        id: "el-1",
        title: "Student Senate 2026",
        status: "open",
        institution_name: "State University",
        has_voted: false,
      },
    ];

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: mockElections }),
    } as Response);

    const res = await apiClient.getMyElections();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/users/me/elections"),
      expect.objectContaining({
        credentials: "include",
      })
    );
    expect(res).toEqual(mockElections);
  });
});
