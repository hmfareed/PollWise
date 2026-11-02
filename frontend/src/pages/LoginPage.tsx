import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, AlertCircle } from "lucide-react";
import { useAuth } from "../features/auth/useAuth";
import { apiClient } from "../lib/api-client";
import { AuthSplitLayout } from "../layouts/AuthSplitLayout";
import { Input, PasswordInput } from "../components/ui/input";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const loginResult = await login({ email: email.trim().toLowerCase(), password });
      let loggedUser = (loginResult as any)?.user;
      if (!loggedUser) {
        try {
          const me = await apiClient.getMe();
          loggedUser = me.user;
        } catch {
          // ignore
        }
      }

      if (loggedUser && !loggedUser.email_verified) {
        navigate("/verify-email");
        return;
      }

      if (loggedUser && loggedUser.account_type !== "institution") {
        try {
          const onboarding = await apiClient.getPersonalOnboarding();
          if (onboarding && onboarding.onboarding_status !== "completed") {
            navigate("/onboarding/personal");
            return;
          }
        } catch {
          // If onboarding cannot be fetched, proceed
        }
        navigate(redirectPath !== "/" ? redirectPath : "/dashboard");
        return;
      }

      navigate(redirectPath);
    } catch (err: any) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      <div className="w-full transition-all">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1528] tracking-tight">
            Welcome Back
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-2 font-normal">
            Sign in to your Pollwise account
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-sm text-red-700 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Email Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Email Address
            </label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Password
            </label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              isPasswordVisible={showPassword}
              onTogglePasswordVisibility={() => setShowPassword(!showPassword)}
              autoComplete="current-password"
            />
          </div>

          {/* Options Row: Remember Me & Forgot Password */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0055FF] focus:ring-[#0055FF] cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">Remember me</span>
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-semibold text-[#0055FF] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3.5 px-4 rounded-xl font-semibold text-white bg-[#0055FF] hover:bg-[#0047E0] shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-base disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
          >
            <span>{isSubmitting ? "Signing In..." : "Sign In"}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Create Account Link with divider lines */}
          <div className="relative my-6 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative inline-block bg-white px-4 text-sm text-slate-600">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="font-semibold text-[#0055FF] hover:underline"
              >
                Create an account
              </Link>
            </div>
          </div>
        </form>
      </div>
    </AuthSplitLayout>
  );
};
