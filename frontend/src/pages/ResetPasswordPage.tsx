import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { PasswordInput } from "../components/ui/input";

export const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError("No reset token provided. Please follow the link in your recovery email.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.resetPassword({ token, new_password: password });
      setIsSuccess(true);
    } catch (err: any) {
      setError(err?.message || "Invalid or expired reset token. Please request a new link.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Card>
        <CardHeader className="space-y-1 text-center">
          <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-primary mx-auto mb-2">
            <Lock className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
          <CardDescription>
            Choose a strong, unique password for your PollWise institutional account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isSuccess ? (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Password Reset Completed</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Your password has been updated and all previous sessions have been safely invalidated. You can now log in with your new credentials.
                </p>
              </div>

              <Button
                onClick={() => navigate("/login")}
                className="w-full gap-2"
              >
                Sign In Now
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                  <span>Missing Reset Token</span>
                </div>
                <p className="text-xs text-amber-700 leading-relaxed">
                  No recovery token was found in the link. Please ensure you clicked the full URL sent to your institutional email.
                </p>
              </div>

              <Link to="/forgot-password">
                <Button variant="outline" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">New Password (min 8 chars)</label>
                <PasswordInput
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your new password"
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                <PasswordInput
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                />
              </div>

              <Button type="submit" className="w-full gap-2 mt-2" disabled={isSubmitting}>
                {isSubmitting ? "Updating Password..." : "Update Password"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
