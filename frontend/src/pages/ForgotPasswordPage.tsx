import React, { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound, Mail, ArrowRight, ArrowLeft, AlertCircle, CheckCircle } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err: any) {
      setError(err?.message || "Unable to process recovery request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Card>
        <CardHeader className="space-y-1 text-center">
          <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-primary mx-auto mb-2">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
          <CardDescription>
            Enter your institutional email address to receive password recovery instructions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>Recovery Instructions Sent</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  If <strong className="font-mono text-emerald-900">{email}</strong> matches an active account,
                  we have dispatched a single-use password reset link. Please check your inbox and spam folders.
                </p>
              </div>

              <div className="pt-2">
                <Link to="/login">
                  <Button variant="outline" className="w-full gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Return to Sign In
                  </Button>
                </Link>
              </div>
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
                <label className="text-xs font-semibold text-foreground">Institutional Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@university.edu"
                    className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full gap-2 mt-2" disabled={isSubmitting}>
                {isSubmitting ? "Sending Instructions..." : "Send Recovery Link"}
                <ArrowRight className="h-4 w-4" />
              </Button>

              <div className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
                Remember your password?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
