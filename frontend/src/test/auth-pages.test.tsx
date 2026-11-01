import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../features/auth/AuthContext";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ForgotPasswordPage } from "../pages/ForgotPasswordPage";
import { ResetPasswordPage } from "../pages/ResetPasswordPage";
import { OrganizationsPage } from "../pages/OrganizationsPage";
import { InstitutionOnboardingPage } from "../pages/InstitutionOnboardingPage";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

describe("Auth & Organizations Pages", () => {
  it("renders LoginPage with email and password inputs", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Welcome Back/i })).toBeInTheDocument();
    expect(screen.getByText(/Sign in to your Pollwise account/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Enter your password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeInTheDocument();
    expect(screen.getByText(/Remember me/i)).toBeInTheDocument();
    expect(screen.getByText(/Forgot password\?/i)).toBeInTheDocument();
    expect(screen.queryByText(/Your data is secure with Pollwise/i)).not.toBeInTheDocument();
  });

  it("renders ForgotPasswordPage with email input", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <ForgotPasswordPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Reset Your Password/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Send Recovery Link/i })).toBeInTheDocument();
  });

  it("renders ResetPasswordPage with token prompt or error if token missing", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <ResetPasswordPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Set New Password/i })).toBeInTheDocument();
    expect(screen.getByText(/Missing Reset Token/i)).toBeInTheDocument();
  });

  it("renders RegisterPage with personal and institution registration options", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <RegisterPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Create an Account/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Personal Account$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Institution Account$/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Alice")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Smith")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Create Personal Account$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Your data is secure with Pollwise/i)).not.toBeInTheDocument();
  });

  it("renders OrganizationsPage", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <OrganizationsPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: "Organizations" })).toBeInTheDocument();
  });

  it("renders InstitutionOnboardingPage at step 1", () => {
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <MemoryRouter>
            <InstitutionOnboardingPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole("heading", { name: /Institution Onboarding Setup/i })).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e\.g\. Northwestern Polytechnic University/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next Step/i })).toBeInTheDocument();
  });
});
