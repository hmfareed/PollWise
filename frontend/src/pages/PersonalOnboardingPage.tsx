import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Key,
  Lock,
  Building2,
  User as UserIcon,
  Camera,
  Copy,
  Check,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import type { MfaSetupResponse, InvitationValidationResponse } from "../types/auth";

const STEPS = [
  { id: 1, label: "Welcome" },
  { id: 2, label: "Profile" },
  { id: 3, label: "Security" },
  { id: 4, label: "Institution" },
  { id: 5, label: "Complete" },
];

export const PersonalOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, refresh } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Step 2 Profile Fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("United States");
  const [preferredLanguage, setPreferredLanguage] = useState("English");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ firstName?: string; lastName?: string }>({});

  // Step 3 MFA Setup Fields
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<MfaSetupResponse | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [isMfaVerified, setIsMfaVerified] = useState(false);
  const [hasCopiedSecret, setHasCopiedSecret] = useState(false);

  // Step 4 Institution Invitation Fields
  const [invitationCode, setInvitationCode] = useState("");
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [validatedInstitution, setValidatedInstitution] = useState<InvitationValidationResponse | null>(null);
  const [joinedInstitutionName, setJoinedInstitutionName] = useState<string | null>(null);

  const hasMarkedCompletedRef = useRef(false);

  // Redirect unverified users to verify email page
  useEffect(() => {
    if (user && !user.email_verified) {
      navigate("/verify-email", { replace: true });
    }
  }, [user, navigate]);

  // Load existing onboarding progress on mount
  useEffect(() => {
    let isMounted = true;
    apiClient
      .getPersonalOnboarding()
      .then((data) => {
        if (!isMounted) return;
        if (data && typeof data.current_step === "number" && data.current_step > 1) {
          setCurrentStep(Math.min(data.current_step, 5));
        }
      })
      .catch((err) => {
        console.warn("Could not retrieve onboarding progress:", err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingProgress(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Prepopulate profile from user info
  useEffect(() => {
    if (user) {
      if (user.first_name) {
        setFirstName(user.first_name);
      } else if (user.display_name && !firstName) {
        setFirstName(user.display_name.split(" ")[0] || "");
      }

      if (user.last_name) {
        setLastName(user.last_name);
      } else if (user.display_name && !lastName) {
        const parts = user.display_name.split(" ");
        if (parts.length > 1) {
          setLastName(parts.slice(1).join(" "));
        }
      }

      if (user.display_name && !displayName) {
        setDisplayName(user.display_name);
      }
      if (user.phone_number && !phoneNumber) {
        setPhoneNumber(user.phone_number);
      }
      if (user.country) {
        setCountry(user.country);
      }
      if (user.preferred_language) {
        setPreferredLanguage(user.preferred_language);
      }
      if (user.profile_image_url && !profileImageUrl) {
        setProfileImageUrl(user.profile_image_url);
      }
    }
  }, [user]);

  // Mark completed when reaching Step 5
  useEffect(() => {
    if (currentStep === 5 && !hasMarkedCompletedRef.current) {
      hasMarkedCompletedRef.current = true;
      apiClient
        .updatePersonalOnboarding(5, "completed")
        .then(() => {
          if (refresh) refresh();
        })
        .catch((err) => {
          console.warn("Failed to mark onboarding as completed:", err);
        });
    }
  }, [currentStep, refresh]);

  // =========================================================================
  // Handlers for Step 1: Welcome
  // =========================================================================
  const handleStep1GetStarted = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.updatePersonalOnboarding(2, "in_progress");
      setCurrentStep(2);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to advance onboarding step");
      setCurrentStep(2);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // Handlers for Step 2: Profile Setup
  // =========================================================================
  const handleFirstNameBlur = () => {
    if (!firstName.trim()) {
      setFieldErrors((prev) => ({ ...prev, firstName: "First name is required" }));
    }
  };

  const handleLastNameBlur = () => {
    if (!lastName.trim()) {
      setFieldErrors((prev) => ({ ...prev, lastName: "Last name is required" }));
    }
  };

  const handleStep2Submit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const errors: { firstName?: string; lastName?: string } = {};
    if (!firstName.trim()) {
      errors.firstName = "First name is required";
    }
    if (!lastName.trim()) {
      errors.lastName = "Last name is required";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await apiClient.updateProfile({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        display_name: displayName.trim() || `${firstName.trim()} ${lastName.trim()}`,
        phone_number: phoneNumber.trim() || undefined,
        country: country || undefined,
        preferred_language: preferredLanguage || undefined,
        profile_image_url: profileImageUrl || undefined,
      });

      await apiClient.updatePersonalOnboarding(3, "in_progress");
      if (refresh) await refresh();
      setCurrentStep(3);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update profile");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      setProfileImageUrl(previewUrl);
    }
  };

  // =========================================================================
  // Handlers for Step 3: Security & MFA
  // =========================================================================
  const handleStartMfaSetup = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.setupMfa();
      setMfaSetupData(data);
      setIsSettingUpMfa(true);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to initialize MFA setup");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyMfa = async () => {
    if (!mfaCode.trim()) {
      setErrorMessage("Please enter the 6-digit verification code");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.verifyMfa(mfaCode.trim());
      setIsMfaVerified(true);
      setSuccessMessage("MFA verified and enabled successfully!");
      await apiClient.updatePersonalOnboarding(4, "in_progress");
      if (refresh) await refresh();
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid verification code. Please check your authenticator app.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipMfa = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.updatePersonalOnboarding(4, "in_progress");
      setCurrentStep(4);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to proceed to next step");
      setCurrentStep(4);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopySecret = () => {
    if (mfaSetupData?.secret) {
      navigator.clipboard?.writeText(mfaSetupData.secret);
      setHasCopiedSecret(true);
      setTimeout(() => setHasCopiedSecret(false), 2000);
    }
  };

  // =========================================================================
  // Handlers for Step 4: Institution Connection
  // =========================================================================
  const handleValidateInvitation = async () => {
    if (!invitationCode.trim()) {
      setErrorMessage("Please enter an invitation code");
      return;
    }
    setIsValidatingCode(true);
    setErrorMessage(null);
    try {
      const data = await apiClient.validateInvitation(invitationCode.trim());
      setValidatedInstitution(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Invalid or expired invitation code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!invitationCode.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiClient.acceptInvitation(invitationCode.trim());
      setJoinedInstitutionName(res.institution_name || validatedInstitution?.institution_name || null);
      await apiClient.updatePersonalOnboarding(5, "in_progress");
      if (refresh) await refresh();
      setCurrentStep(5);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to join institution");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipInstitution = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await apiClient.updatePersonalOnboarding(5, "in_progress");
      setCurrentStep(5);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to proceed to completion step");
      setCurrentStep(5);
    } finally {
      setIsSubmitting(false);
    }
  };

  // =========================================================================
  // Render Loading State
  // =========================================================================
  if (isLoadingProgress) {
    return (
      <div className="min-h-[500px] flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-slate-600 font-medium">Loading your onboarding progress...</p>
        </div>
      </div>
    );
  }

  if (user && !user.email_verified) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12 animate-fade-in pb-16">
      {/* Top Header & Step Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              Step {currentStep} of 5
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {STEPS[currentStep - 1]?.label}
            </span>
          </div>
          <div className="text-xs font-medium text-slate-400">
            Personal Account Onboarding
          </div>
        </div>

        {/* Progress Bar Track */}
        <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden shadow-inner">
          <div
            className="bg-blue-600 h-full transition-all duration-300 ease-out rounded-full shadow-xs"
            style={{ width: `${(currentStep / 5) * 100}%` }}
          />
        </div>

        {/* Step indicator breadcrumb tabs */}
        <div className="grid grid-cols-5 gap-2 mt-3">
          {STEPS.map((step) => {
            const isPassed = step.id < currentStep;
            const isCurrent = step.id === currentStep;
            return (
              <div
                key={step.id}
                className={`text-center py-1.5 px-1 rounded-lg text-xs font-medium transition-colors ${
                  isCurrent
                    ? "bg-blue-50 text-blue-700 font-bold border border-blue-200"
                    : isPassed
                    ? "text-blue-900 bg-slate-50"
                    : "text-slate-400 bg-slate-50/50"
                }`}
              >
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Global Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start gap-3 animate-fade-in"
        >
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-medium">{errorMessage}</div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-600 text-sm font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Global Success Alert */}
      {successMessage && (
        <div
          role="status"
          className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 flex items-start gap-3 animate-fade-in"
        >
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm font-medium">{successMessage}</div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-green-500 hover:text-green-700 text-sm font-semibold"
          >
            ✕
          </button>
        </div>
      )}

      {/* ===================================================================== */}
      {/* STEP 1: WELCOME TO POLLWISE                                           */}
      {/* ===================================================================== */}
      {currentStep === 1 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="text-center pb-4 pt-8">
            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md">
              <img
                src="/pollwise-emblem.png"
                alt="PollWise Emblem"
                className="h-10 w-10 object-contain"
                onError={(e) => {
                  // Fallback icon if image asset fails to load in test environment
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-blue-950">
              Welcome to Pollwise{user?.first_name ? `, ${user.first_name}` : ""}!
            </CardTitle>
            <CardDescription className="text-base text-slate-600 max-w-lg mx-auto mt-2 leading-relaxed">
              Your personal account is ready. Complete a few quick steps to prepare your account for secure and convenient voting.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-2 pb-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-3">
                  <UserIcon className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Personal Profile</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Customize your identity, display name, and preferences.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center mb-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Account Security</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Configure multi-factor authentication to protect your vote.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/60 flex flex-col items-center text-center">
                <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center mb-3">
                  <Building2 className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-bold text-slate-900">Join Institutions</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Connect invitation codes to participate in institutional ballots.
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                type="button"
                onClick={handleStep1GetStarted}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 h-12 text-base font-semibold bg-blue-600 hover:bg-blue-700 gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* STEP 2: COMPLETE PERSONAL PROFILE                                     */}
      {/* ===================================================================== */}
      {currentStep === 2 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">
              Complete Personal Profile
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Review and complete your profile information. Required fields are marked with an asterisk (*).
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleStep2Submit} className="space-y-6">
              {/* Profile Photo Preview & Upload */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm font-bold text-xl">
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
                        alt="Profile Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span>
                        {firstName?.[0] || user?.first_name?.[0] || "U"}
                        {lastName?.[0] || user?.last_name?.[0] || ""}
                      </span>
                    )}
                  </div>
                  <label
                    htmlFor="photo-upload"
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition-transform hover:scale-105"
                    title="Upload photo"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="sr-only"
                    />
                  </label>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <h4 className="text-sm font-bold text-slate-900">Profile Photo (Optional)</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Upload an avatar image to personalize your ballot and account profile.
                  </p>
                  {profileImageUrl && (
                    <button
                      type="button"
                      onClick={() => setProfileImageUrl("")}
                      className="text-xs text-red-600 hover:text-red-700 font-medium mt-1 underline"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* First Name */}
                <div className="space-y-1.5">
                  <label htmlFor="first-name" className="text-sm font-semibold text-slate-700">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      if (fieldErrors.firstName) {
                        setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                      }
                    }}
                    onBlur={handleFirstNameBlur}
                    placeholder="Enter first name"
                    error={!!fieldErrors.firstName}
                  />
                  {fieldErrors.firstName && (
                    <p className="text-xs text-red-600 font-medium">{fieldErrors.firstName}</p>
                  )}
                </div>

                {/* Last Name */}
                <div className="space-y-1.5">
                  <label htmlFor="last-name" className="text-sm font-semibold text-slate-700">
                    Last Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      if (fieldErrors.lastName) {
                        setFieldErrors((prev) => ({ ...prev, lastName: undefined }));
                      }
                    }}
                    onBlur={handleLastNameBlur}
                    placeholder="Enter last name"
                    error={!!fieldErrors.lastName}
                  />
                  {fieldErrors.lastName && (
                    <p className="text-xs text-red-600 font-medium">{fieldErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Display Name */}
              <div className="space-y-1.5">
                <label htmlFor="display-name" className="text-sm font-semibold text-slate-700">
                  Display Name
                </label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How your name appears to others"
                />
                <p className="text-xs text-slate-500">
                  Defaults to your full name if left blank.
                </p>
              </div>

              {/* Phone Number */}
              <div className="space-y-1.5">
                <label htmlFor="phone-number" className="text-sm font-semibold text-slate-700">
                  Phone Number
                </label>
                <Input
                  id="phone-number"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
                <p className="text-xs text-slate-500">
                  Used for account recovery and emergency election notifications.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Country */}
                <div className="space-y-1.5">
                  <label htmlFor="country" className="text-sm font-semibold text-slate-700">
                    Country or Region
                  </label>
                  <Select
                    id="country"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                  >
                    <option value="United States">United States</option>
                    <option value="Canada">Canada</option>
                    <option value="United Kingdom">United Kingdom</option>
                    <option value="Australia">Australia</option>
                    <option value="Germany">Germany</option>
                    <option value="France">France</option>
                    <option value="Other">Other</option>
                  </Select>
                </div>

                {/* Preferred Language */}
                <div className="space-y-1.5">
                  <label htmlFor="preferred-language" className="text-sm font-semibold text-slate-700">
                    Preferred Language
                  </label>
                  <Select
                    id="preferred-language"
                    value={preferredLanguage}
                    onChange={(e) => setPreferredLanguage(e.target.value)}
                  >
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="French">French</option>
                    <option value="German">German</option>
                    <option value="Arabic">Arabic</option>
                  </Select>
                </div>
              </div>

              <div className="pt-4 flex justify-between items-center border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 bg-blue-600 hover:bg-blue-700 font-semibold"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Saving...
                    </>
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* STEP 3: SET UP ACCOUNT SECURITY                                       */}
      {/* ===================================================================== */}
      {currentStep === 3 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">
              Set Up Account Security
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Protect your personal voter account and ballots with two-factor authentication.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Password Status Banner */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-100 text-green-700 flex items-center justify-center">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Password Status</h4>
                  <p className="text-xs text-slate-500">Your password is encrypted and meets security policy.</p>
                </div>
              </div>
              <Badge variant="success" className="text-xs px-2.5 py-1">
                Active & Protected
              </Badge>
            </div>

            {/* MFA Section */}
            {!isSettingUpMfa ? (
              <div className="p-6 rounded-2xl border border-blue-100 bg-blue-50/40 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900">
                      Multi-Factor Authentication (MFA)
                    </h4>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Add a critical layer of defense to your voting eligibility and ballot signatures. We recommend configuring an authenticator app (Google Authenticator, Microsoft Authenticator, or 1Password).
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleStartMfaSetup}
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700 font-semibold gap-2 shadow-sm"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Key className="h-4 w-4" />
                    )}
                    Set Up MFA
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSkipMfa}
                    disabled={isSubmitting}
                    className="border-slate-300 text-slate-700 hover:bg-slate-100"
                  >
                    Do This Later
                  </Button>
                </div>
              </div>
            ) : (
              /* MFA Active Setup Flow */
              <div className="space-y-6 animate-fade-in">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
                  <h4 className="text-sm font-bold text-slate-900">
                    Step 1: Add to your authenticator app
                  </h4>
                  <p className="text-xs text-slate-600">
                    Enter the following secret key into your authenticator app (or scan the OTP auth URI):
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="px-4 py-2 rounded-lg bg-white border border-slate-200 font-mono text-sm font-bold text-blue-900 select-all tracking-wider">
                      {mfaSetupData?.secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleCopySecret}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      {hasCopiedSecret ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-green-600" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          Copy Secret
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Recovery Codes Display */}
                {mfaSetupData?.recovery_codes && mfaSetupData.recovery_codes.length > 0 && (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                    <h4 className="text-sm font-bold text-amber-900 flex items-center gap-1.5">
                      <Key className="h-4 w-4 text-amber-700" />
                      Save Your 8 Recovery Codes
                    </h4>
                    <p className="text-xs text-amber-800">
                      If you lose access to your authenticator device, each code can be used once to regain access:
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
                      {mfaSetupData.recovery_codes.map((code, idx) => (
                        <div
                          key={idx}
                          className="bg-white border border-amber-200 px-2 py-1.5 rounded text-center font-bold text-slate-800"
                        >
                          {code}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6-Digit Code Verification */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-sm font-bold text-slate-900">
                    Step 2: Verify 6-digit code
                  </h4>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="mfa-verification-code"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value)}
                      placeholder="123456"
                      maxLength={6}
                      className="max-w-xs font-mono tracking-widest text-lg"
                    />
                    <Button
                      type="button"
                      onClick={handleVerifyMfa}
                      disabled={isSubmitting || mfaCode.length < 6}
                      className="bg-blue-600 hover:bg-blue-700 font-semibold gap-2"
                    >
                      {isSubmitting ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                      Verify & Enable MFA
                    </Button>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 flex justify-between items-center border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipMfa}
                disabled={isSubmitting}
                className="text-slate-500 hover:text-slate-800"
              >
                Skip security setup for now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* STEP 4: CONNECT TO INSTITUTION / ENTER INVITATION CODE                */}
      {/* ===================================================================== */}
      {currentStep === 4 && (
        <Card className="border-slate-200 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl sm:text-2xl font-bold text-slate-900">
              Connect to Your Institution
            </CardTitle>
            <CardDescription className="text-sm text-slate-600">
              Enter an invitation code from your university, labor union, or organization to access eligible elections.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-3">
              <label htmlFor="invitation-code" className="text-sm font-semibold text-slate-700">
                Invitation Code
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  id="invitation-code"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  placeholder="Enter invitation code (e.g. CAMPUS-2026)"
                  className="font-mono"
                />
                <Button
                  type="button"
                  onClick={handleValidateInvitation}
                  disabled={isValidatingCode || !invitationCode.trim()}
                  variant="outline"
                  className="font-semibold shrink-0"
                >
                  {isValidatingCode ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Validating...
                    </>
                  ) : (
                    "Validate Code"
                  )}
                </Button>
              </div>
            </div>

            {/* Validated Institution Preview Card */}
            {validatedInstitution && (
              <div className="p-5 rounded-2xl bg-green-50/60 border border-green-200 space-y-3 animate-fade-in">
                <div className="flex items-center gap-2.5 text-green-800">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Invitation Verified
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">
                      {validatedInstitution.institution_name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Type: <span className="capitalize">{validatedInstitution.invitation_type}</span>
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAcceptInvitation}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold gap-2 shadow-xs"
                  >
                    {isSubmitting ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Confirm & Join
                  </Button>
                </div>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
              <Building2 className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="text-xs text-slate-500 leading-relaxed">
                Don't have an invitation code right now? No problem. You can join your organization or enter invitation codes at any time from your Personal Dashboard.
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(3)}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleSkipInstitution}
                disabled={isSubmitting}
                className="text-slate-600 hover:text-slate-900 font-medium"
              >
                Skip for Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* STEP 5: ONBOARDING COMPLETION                                         */}
      {/* ===================================================================== */}
      {currentStep === 5 && (
        <Card className="border-slate-200 shadow-lg text-center overflow-hidden">
          <div className="bg-gradient-to-b from-blue-50 to-white pt-10 pb-4 px-6">
            <div className="mx-auto mb-4 h-20 w-20 rounded-full bg-green-100 text-green-600 flex items-center justify-center shadow-sm">
              <CheckCircle2 className="h-12 w-12" />
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-extrabold text-blue-950">
              You're all set!
            </CardTitle>
            <CardDescription className="text-base text-slate-600 max-w-md mx-auto mt-2">
              Your Pollwise personal account is ready.
            </CardDescription>
          </div>

          <CardContent className="p-6 sm:p-8 space-y-6">
            <div className="max-w-md mx-auto p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Account Summary
              </h4>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Profile:</span>
                <span className="font-semibold text-slate-900">
                  {firstName} {lastName}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Security:</span>
                <span className="font-semibold text-slate-900">
                  {isMfaVerified ? "MFA Configured" : "Password Protected"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Institution:</span>
                <span className="font-semibold text-slate-900">
                  {joinedInstitutionName
                    ? joinedInstitutionName
                    : validatedInstitution?.institution_name
                    ? validatedInstitution.institution_name
                    : "No institution connected yet"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base shadow-sm gap-2"
              >
                Go to My Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/elections")}
                className="h-12 px-6 border-slate-200 text-slate-700 font-semibold"
              >
                Explore Elections
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
