import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, Eye, EyeOff, ArrowRight, AlertCircle, ShieldCheck } from "lucide-react";
import { useAuth } from "../features/auth/useAuth";
import { AuthSplitLayout } from "../layouts/AuthSplitLayout";

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
      await login({ email: email.trim().toLowerCase(), password });
      navigate(redirectPath);
    } catch (err: any) {
      setError(err?.message || "Invalid email or password.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout>
      {/* Floating White Card matching mockup */}
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 p-8 sm:p-11 w-full transition-all">
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
            <div className="relative flex items-center">
              <Mail className="absolute left-4 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="w-full pl-12 pr-4 py-3.5 text-sm sm:text-base rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0055FF] focus:border-transparent transition-all shadow-sm"
              />
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Password
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-4 h-5 w-5 text-slate-400 pointer-events-none" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-12 pr-12 py-3.5 text-sm sm:text-base rounded-xl border border-slate-200 bg-white placeholder:text-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0055FF] focus:border-transparent transition-all shadow-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 p-1 text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
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

        {/* Security & Data Trust Badge */}
        <div className="mt-8 bg-blue-50/80 border border-blue-100 rounded-2xl p-4 flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-blue-100/80 flex items-center justify-center text-[#0055FF] flex-shrink-0">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 leading-tight">
              Your data is secure with Pollwise
            </h4>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Built with advanced security standards.
            </p>
          </div>
        </div>
      </div>
    </AuthSplitLayout>
  );
};
