import React from "react";
import { Navigate, useLocation, Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requireAdmin?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requireAdmin = false,
}) => {
  const { isAuthenticated, isLoading, user, memberships } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] space-y-3">
        <Loader2 className="h-8 w-8 text-primary animate-spin" />
        <p className="text-xs text-muted-foreground font-medium">Verifying session credentials...</p>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?redirect=${returnUrl}`} replace />;
  }

  // Check RBAC permissions if requested
  const isPlatformAdmin = !!user.is_platform_admin;
  const userRoles = memberships.map((m) => m.role);

  let hasPermission = true;

  if (requireAdmin) {
    const adminRoles = ["organization_admin", "election_manager", "auditor"];
    hasPermission = isPlatformAdmin || userRoles.some((r) => adminRoles.includes(r));
  } else if (requiredRoles && requiredRoles.length > 0) {
    hasPermission = isPlatformAdmin || userRoles.some((r) => requiredRoles.includes(r));
  }

  if (!hasPermission) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4">
        <Card className="border-amber-200 bg-amber-50/40 shadow-sm">
          <CardHeader className="text-center space-y-2">
            <div className="h-12 w-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <CardTitle className="text-xl font-bold text-amber-950">Institutional Access Restricted</CardTitle>
            <CardDescription className="text-amber-800 text-xs">
              This area is restricted to authorized administrative personnel.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-xs text-amber-900 leading-relaxed">
              Your account (<strong className="font-mono">{user.email}</strong>) does not hold an authorized
              administrative role (e.g. <em>Organization Admin</em>, <em>Election Manager</em>, or <em>Auditor</em>)
              for this operation.
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Link to="/elections">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Return to Elections
                </Button>
              </Link>
              <Link to="/settings">
                <Button size="sm" className="text-xs">
                  Review Account Roles
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
