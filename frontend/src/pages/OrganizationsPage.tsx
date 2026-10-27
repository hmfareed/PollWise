import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Shield, CheckCircle, AlertCircle } from "lucide-react";
import { apiClient } from "../lib/api-client";
import { useAuth } from "../features/auth/useAuth";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";

export const OrganizationsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: orgs, isLoading, error } = useQuery({
    queryKey: ["organizations"],
    queryFn: apiClient.getOrganizations,
    enabled: isAuthenticated,
  });

  const createOrgMutation = useMutation({
    mutationFn: apiClient.createOrganization,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      setName("");
      setSlug("");
      setShowCreateForm(false);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.message || "Failed to create organization");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createOrgMutation.mutate({
      name: name.trim(),
      slug: slug.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Manage institutions, student bodies, departments, and member role assignments.
          </p>
        </div>
        {isAuthenticated && (
          <Button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? "Cancel" : "New Organization"}
          </Button>
        )}
      </div>

      {!isAuthenticated && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="p-6 text-center space-y-3">
            <Shield className="h-8 w-8 text-primary mx-auto" />
            <p className="font-semibold text-foreground">Sign In Required</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Please sign in with your verified institutional account to view and administer your organizations.
            </p>
          </CardContent>
        </Card>
      )}

      {showCreateForm && (
        <Card className="border-primary/40 shadow-sm animate-in fade-in-50 duration-200">
          <CardHeader>
            <CardTitle className="text-lg">Create New Organization</CardTitle>
            <CardDescription>
              Establish a new institutional entity to conduct authorized elections.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-danger flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Organization Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Faculty of Medicine"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Unique Slug (Optional)</label>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    placeholder="e.g. faculty-of-medicine"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createOrgMutation.isPending}>
                  {createOrgMutation.isPending ? "Creating..." : "Create Organization"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isAuthenticated && (
        <div className="space-y-4">
          {isLoading && (
            <div className="text-center py-8 text-xs text-muted-foreground">
              Loading organizations...
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-danger">
              Failed to load organizations. Please try again.
            </div>
          )}

          {orgs && orgs.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm space-y-2">
                <Users className="h-8 w-8 mx-auto text-slate-300" />
                <p className="font-semibold text-foreground">No Organizations Yet</p>
                <p className="text-xs text-muted-foreground">
                  Create your first organization or ask an administrator to invite you to one.
                </p>
              </CardContent>
            </Card>
          )}

          {orgs && orgs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {orgs.map((org) => (
                <Card key={org.id} className="hover:border-slate-300 transition-colors">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{org.name}</CardTitle>
                        <p className="text-xs font-mono text-muted-foreground">/{org.slug}</p>
                      </div>
                      <Badge variant={org.status === "active" ? "success" : "secondary"}>
                        {org.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle className="h-3.5 w-3.5 text-success" />
                        <span>RBAC Isolated</span>
                      </div>
                      <span className="text-[11px]">
                        Registered: {new Date(org.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
