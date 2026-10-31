import React, { useState } from "react";
import { 
  ShieldCheck, 
  KeyRound, 
  Building2, 
  LogOut, 
  CheckCircle, 
  AlertCircle, 
  CheckCircle2, 
  Clock
} from "lucide-react";
import { useAuth } from "../features/auth/useAuth";
import { apiClient } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

export const SettingsPage: React.FC = () => {
  const { user, memberships, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiClient.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(res.message || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err?.message || "Failed to update password. Verify your current password.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const formatRole = (role: string) => {
    switch (role) {
      case "organization_admin":
        return "Organization Administrator";
      case "election_manager":
        return "Election Manager";
      case "auditor":
        return "Electoral Auditor";
      case "member":
        return "Eligible Voter / Member";
      default:
        return role;
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-2">
      <div className="border-b border-border pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Account & Security Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your institutional identity, verified credentials, and active roles.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Profile Card */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader className="text-center pb-2">
              <div className="h-16 w-16 rounded-full bg-blue-100 text-primary flex items-center justify-center mx-auto text-xl font-bold">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <CardTitle className="text-base pt-2">{user.display_name}</CardTitle>
              <CardDescription className="text-xs font-mono">{user.email}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-2 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Email Status</span>
                {user.email_verified ? (
                  <Badge variant="success" className="gap-1 text-[11px]">
                    <CheckCircle className="h-3 w-3" />
                    Verified
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1 text-[11px]">
                    <Clock className="h-3 w-3" />
                    Unverified
                  </Badge>
                )}
              </div>

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Account Status</span>
                <span className="font-semibold capitalize text-foreground">{user.account_status}</span>
              </div>

              {user.is_platform_admin && (
                <div className="flex items-center justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Platform Role</span>
                  <Badge variant="default" className="text-[11px] bg-blue-700">Platform Admin</Badge>
                </div>
              )}

              <div className="flex items-center justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Member Since</span>
                <span className="text-muted-foreground">
                  {new Date(user.created_at).toLocaleDateString()}
                </span>
              </div>

              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={logout}
                  className="w-full gap-2 text-danger hover:text-danger hover:bg-red-50 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Security Advisory */}
          <Card className="bg-slate-50 border-slate-200">
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span>Zero Identity Leakage</span>
              </div>
              <p className="text-slate-600 leading-relaxed text-[11px]">
                Your account password and identity are stored in the isolated <code className="text-slate-800">identity_db</code>. Your voted choices in the ballot box can never be traced back to this account.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Roles & Password Change */}
        <div className="md:col-span-2 space-y-6">
          {/* Institutional Memberships Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Institutional Memberships & Roles</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Your assigned roles across tenant institutions and academic departments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memberships.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  You are not currently enrolled in any institutional organizations.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {memberships.map((m) => (
                    <div key={m.id} className="py-3 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">{m.organization_name}</p>
                        <p className="text-xs font-mono text-muted-foreground">/{m.organization_slug}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-medium">
                          {formatRole(m.role)}
                        </Badge>
                        <Badge variant={m.status === "active" ? "success" : "secondary"}>
                          {m.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Change Account Password</CardTitle>
              </div>
              <CardDescription className="text-xs">
                Update your credentials using Argon2id password hashing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {passwordSuccess && (
                  <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{passwordError}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Current Password</label>
                  <input
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">New Password (min 8 chars)</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Confirm New Password</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isChangingPassword} className="text-xs">
                    {isChangingPassword ? "Updating Password..." : "Update Password"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
