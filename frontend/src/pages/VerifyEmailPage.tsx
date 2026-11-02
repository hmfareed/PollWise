import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertCircle, MailCheck, Loader2, ArrowRight } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import type { User } from "../types/auth";

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(!!token);
  const [error, setError] = useState<string | null>(
    token
      ? null
      : "No email verification token found. Please use the link provided in your confirmation email."
  );
  const [success, setSuccess] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    apiClient
      .verifyEmail(token)
      .then((user) => {
        if (isMounted) {
          setVerifiedUser(user);
          setSuccess(true);
          setError(null);
        }
      })
      .catch((err: any) => {
        if (isMounted) {
          setError(err?.message || "Invalid or expired verification token.");
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <Card>
        <CardHeader className="space-y-1 text-center">
          <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center text-primary mx-auto mb-2">
            <MailCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
          <CardDescription>
            Validating voter identity and account credentials
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="text-center py-8 space-y-3">
              <Loader2 className="h-8 w-8 text-primary animate-spin mx-auto" />
              <p className="text-sm font-medium text-foreground">Verifying your email address...</p>
              <p className="text-xs text-muted-foreground">Confirming cryptographic token in Identity DB</p>
            </div>
          )}

          {!isLoading && success && (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
                  <span>Email Verified Successfully</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  {verifiedUser?.account_type === "personal"
                    ? "Your personal email has been verified. Welcome to Pollwise! Complete your profile to get started."
                    : "Your institutional email has been verified. You now have full voting and administrative access according to your organizational entitlements."}
                </p>
              </div>

              {verifiedUser?.account_type === "personal" ? (
                <Link to="/onboarding/personal">
                  <Button className="w-full gap-2">
                    Continue to Onboarding
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link to="/elections">
                  <Button className="w-full gap-2">
                    View Eligible Elections
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </div>
          )}

          {!isLoading && error && (
            <div className="space-y-5 text-center">
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-left space-y-2">
                <div className="flex items-center gap-2 text-danger font-semibold text-sm">
                  <AlertCircle className="h-5 w-5 text-danger flex-shrink-0" />
                  <span>Verification Failed</span>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">
                  {error}
                </p>
              </div>

              <Link to="/login">
                <Button variant="outline" className="w-full gap-2">
                  Return to Sign In
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
