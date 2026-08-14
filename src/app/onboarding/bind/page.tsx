"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/shared/loading-state";
import { AuthProvider, useAuth } from "@/stores/auth-context";
import {
  useBindWorkspace,
  useOnboardingStatus,
} from "@/hooks/use-onboarding-status";

export default function BindWorkspacePage() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BindWorkspaceContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function BindWorkspaceContent() {
  const router = useRouter();
  const t = useTranslations("onboarding.binding");
  const { user, isLoading: authLoading, signOut } = useAuth();
  const statusQuery = useOnboardingStatus({
    enabled: !authLoading && Boolean(user),
  });
  const bindWorkspace = useBindWorkspace();
  const [bindingCode, setBindingCode] = useState("");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/login");
  }, [authLoading, user, router]);

  useEffect(() => {
    if (
      statusQuery.data?.status === "ready" ||
      statusQuery.data?.status === "workspace_creation_required"
    ) {
      router.replace("/app");
    }
  }, [statusQuery.data?.status, router]);

  if (authLoading || statusQuery.isLoading || !user) {
    return <LoadingState text={t("checking")} skeleton={false} />;
  }

  if (statusQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-page p-4">
        <section className="w-full max-w-md space-y-4 rounded-xl bg-page-alt p-8 text-center shadow-lg">
          <p className="text-body text-text-secondary">{t("loadFailed")}</p>
          <Button type="button" onClick={() => statusQuery.refetch()}>
            {t("retry")}
          </Button>
        </section>
      </main>
    );
  }

  const status = statusQuery.data;
  const setupRequired = status?.status === "binding_setup_required";
  const expired =
    status?.status === "binding_required" && status.reason === "expired_invite";
  const canBind =
    status?.status === "binding_required" && status.reason === "pending_invite";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!bindingCode.trim()) return;
    try {
      await bindWorkspace.mutateAsync(bindingCode);
      router.replace("/app");
    } catch {
      // The mutation exposes the safe server error below the field.
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-4">
      <section className="w-full max-w-md space-y-6 rounded-xl bg-page-alt p-8 shadow-lg">
        <div className="flex flex-col items-center space-y-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent">
            <Building2 className="text-white" size={24} aria-hidden="true" />
          </div>
          <h1 className="text-display text-text-primary">{t("title")}</h1>
          <p className="text-body-small text-text-secondary">{t("description")}</p>
        </div>

        {setupRequired && (
          <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
            {t("setupRequired")}
          </p>
        )}

        {expired && (
          <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
            {t("expired")}
          </p>
        )}

        {canBind && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="binding-code" className="text-label text-text-secondary">
                {t("codeLabel")}
              </label>
              <Input
                id="binding-code"
                type="password"
                autoComplete="off"
                value={bindingCode}
                onChange={(event) => setBindingCode(event.target.value)}
                placeholder={t("codePlaceholder")}
                disabled={bindWorkspace.isPending}
                required
                minLength={8}
              />
            </div>
            {bindWorkspace.error && (
              <p className="text-sm text-danger" role="alert">
                {t("invalidCode")}
              </p>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={bindWorkspace.isPending || !bindingCode.trim()}
            >
              {bindWorkspace.isPending ? t("binding") : t("bindButton")}
            </Button>
          </form>
        )}

        <Button
          type="button"
          variant="link"
          className="w-full"
          onClick={() => signOut().then(() => router.replace("/login"))}
          disabled={bindWorkspace.isPending}
        >
          {t("signOut")}
        </Button>
      </section>
    </main>
  );
}
