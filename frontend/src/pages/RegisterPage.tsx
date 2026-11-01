import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  MailCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { AuthSplitLayout } from "../layouts/AuthSplitLayout";
import { Input, PasswordInput } from "../components/ui/input";
import { Select } from "../components/ui/select";

const INSTITUTION_TYPES = [
  "University",
  "College",
  "Secondary school",
  "Professional association",
  "Student union",
  "Corporate organization",
  "Nonprofit organization",
  "Other",
];

const COMMON_COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "India",
  "Nigeria",
  "South Africa",
  "Singapore",
  "Other",
];

export const RegisterPage: React.FC = () => {
  const [accountType, setAccountType] = useState<"personal" | "institution">("personal");

  // Personal Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Institution Fields
  const [institutionName, setInstitutionName] = useState("");
  const [institutionType, setInstitutionType] = useState("University");
  const [country, setCountry] = useState("United States");

  // Status & Verification state
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  // Resend state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    if (!termsAccepted) {
      setError("You must accept the terms of service and privacy policy to proceed.");
      return;
    }

    setIsSubmitting(true);

    try {
      if (accountType === "institution") {
        await apiClient.register({
          account_type: "institution",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          institution_name: institutionName.trim(),
          institution_type: institutionType,
          country,
          terms_accepted: true,
        });
      } else {
        await apiClient.register({
          account_type: "personal",
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          password,
          terms_accepted: true,
        });
      }

      setRegisteredEmail(email.trim().toLowerCase());
      setIsRegistered(true);
    } catch (err: any) {
      setError(err?.message || "Registration failed. Please check your information.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !registeredEmail) return;

    try {
      const res = await apiClient.resendVerification(registeredEmail);
      setResendMessage(res.message || "A fresh verification link has been sent to your email.");
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setResendMessage("Unable to send another link right now. Please check your spam folder.");
    }
  };

  // ========================================================================
  // VIEW: POST-REGISTRATION EMAIL VERIFICATION SCREEN
  // ========================================================================
  if (isRegistered) {
    return (
      <AuthSplitLayout>
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 p-8 sm:p-11 w-full text-center">
          <div className="h-16 w-16 rounded-2xl bg-blue-50 text-[#0055FF] flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <MailCheck className="h-8 w-8" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#0B1528] tracking-tight">
            Verify Your Email
          </h2>
          <p className="text-slate-500 text-sm mt-2">
            We sent an activation link to your registered email address:
          </p>
          <p className="font-mono text-sm font-semibold text-slate-800 my-4 py-2 px-3 bg-slate-50 border border-slate-200 rounded-xl inline-block">
            {registeredEmail}
          </p>

          <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
            Click the link in your email to verify your identity and activate your Pollwise account.
          </p>

          {resendMessage && (
            <div className="mb-6 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 text-left">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>{resendMessage}</span>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${resendCooldown > 0 ? "animate-spin" : ""}`} />
              <span>
                {resendCooldown > 0
                  ? `Resend available in ${resendCooldown}s`
                  : "Resend Verification Email"}
              </span>
            </button>

            <Link
              to="/login"
              className="block w-full py-3 px-4 rounded-xl text-center font-semibold text-[#0055FF] hover:bg-blue-50/50 text-sm transition-all"
            >
              Return to Sign In
            </Link>
          </div>
        </div>
      </AuthSplitLayout>
    );
  }

  // ========================================================================
  // VIEW: REGISTRATION FORM SCREEN
  // ========================================================================
  return (
    <AuthSplitLayout>
      <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-100 p-8 sm:p-11 w-full transition-all">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0B1528] tracking-tight">
            Create an Account
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-2 font-normal">
            Get started with secure institutional voting
          </p>
        </div>

        {/* Account Type Toggle Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6 select-none">
          <button
            type="button"
            onClick={() => setAccountType("personal")}
            className={`py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              accountType === "personal"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Personal Account
          </button>
          <button
            type="button"
            onClick={() => setAccountType("institution")}
            className={`py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              accountType === "institution"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            Institution Account
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-sm text-red-700 flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* First & Last Name */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                First Name
              </label>
              <Input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Alice"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Last Name
              </label>
              <Input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                autoComplete="family-name"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              {accountType === "institution" ? "Official Institution Email" : "Email Address"}
            </label>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                accountType === "institution"
                  ? "admin@university.edu"
                  : "Enter your email address"
              }
              autoComplete="email"
            />
          </div>

          {/* Conditional Institution Fields */}
          {accountType === "institution" && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  Institution Name
                </label>
                <Input
                  type="text"
                  required
                  value={institutionName}
                  onChange={(e) => setInstitutionName(e.target.value)}
                  placeholder="e.g. Northwestern Polytechnic University"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Institution Type
                  </label>
                  <Select
                    value={institutionType}
                    onChange={(e) => setInstitutionType(e.target.value)}
                  >
                    {INSTITUTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                    Country
                  </label>
                  <Select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    {COMMON_COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </>
          )}

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Password
            </label>
            <PasswordInput
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              isPasswordVisible={showPassword}
              onTogglePasswordVisibility={() => setShowPassword(!showPassword)}
              autoComplete="new-password"
            />
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">
              Confirm Password
            </label>
            <PasswordInput
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your password"
              isPasswordVisible={showConfirmPassword}
              onTogglePasswordVisibility={() => setShowConfirmPassword(!showConfirmPassword)}
              autoComplete="new-password"
            />
          </div>

          {/* Terms Checkbox */}
          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                required
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-slate-300 text-[#0055FF] focus:ring-[#0055FF] cursor-pointer"
              />
              <span className="text-xs text-slate-600 leading-normal">
                I agree to the{" "}
                <Link to="/terms" className="text-[#0055FF] hover:underline font-medium">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="text-[#0055FF] hover:underline font-medium">
                  Privacy Policy
                </Link>
                .
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-white bg-[#0055FF] hover:bg-[#0047E0] shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-60 cursor-pointer"
          >
            <span>
              {isSubmitting
                ? "Creating Account..."
                : accountType === "institution"
                ? "Register Institution"
                : "Create Personal Account"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>

          {/* Sign In Link Divider */}
          <div className="relative my-5 text-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative inline-block bg-white px-3 text-xs text-slate-500">
              Already have an account?{" "}
              <Link to="/login" className="font-semibold text-[#0055FF] hover:underline">
                Sign In
              </Link>
            </div>
          </div>
        </form>

        {/* Security & Data Trust Badge */}
        <div className="mt-6 bg-blue-50/80 border border-blue-100 rounded-2xl p-3.5 flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-blue-100/80 flex items-center justify-center text-[#0055FF] flex-shrink-0">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 leading-tight">
              Your data is secure with Pollwise
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              Built with advanced security standards.
            </p>
          </div>
        </div>
      </div>
    </AuthSplitLayout>
  );
};
