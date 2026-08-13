"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/stores/auth-context";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceProvider } from "@/stores/workspace-context";
import { GracePeriodBanner } from "@/components/billing/grace-period-banner";
import { UpgradeBanner } from "@/components/billing/upgrade-banner";
import { ExpirationBanner } from "@/components/billing/expiration-banner";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";
import { getWorkspaceAccessMode } from "@/lib/workspace/access";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const workspaceQuery = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("auth.login");

  const mode = getWorkspaceAccessMode(workspaceQuery.data);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (
      user &&
      !workspaceQuery.isLoading &&
      mode === "expired" &&
      pathname !== "/expired"
    ) {
      router.replace("/expired");
    }
  }, [user, workspaceQuery.isLoading, mode, pathname, router]);

  if (isLoading) {
    return <LoadingState text={t("checkingAuth")} />;
  }

  if (!user) {
    return null;
  }

  if (workspaceQuery.isLoading) {
    return <LoadingState text={t("checkingWorkspace")} />;
  }

  if (workspaceQuery.isError) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-body text-text-secondary">{t("workspaceLoadFailed")}</p>
        <Button type="button" onClick={() => workspaceQuery.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const readOnly = mode === "readonly";

  return (
    <WorkspaceProvider
      workspace={workspaceQuery.data ?? null}
      readOnly={readOnly}
    >
      {mode === "grace" && <GracePeriodBanner />}
      {<UpgradeBanner />}
      {mode === "readonly" && <ExpirationBanner />}
      {children}
    </WorkspaceProvider>
  );
}