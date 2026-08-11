"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/stores/auth-context";
import { useWorkspace } from "@/hooks/use-workspace";
import { WorkspaceProvider } from "@/stores/workspace-context";
import { GracePeriodBanner } from "@/components/billing/grace-period-banner";
import { ExpirationBanner } from "@/components/billing/expiration-banner";
import { LoadingState } from "@/components/shared/loading-state";
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

  const readOnly = mode === "readonly";

  return (
    <WorkspaceProvider
      workspace={workspaceQuery.data ?? null}
      readOnly={readOnly}
    >
      {mode === "grace" && <GracePeriodBanner />}
      {mode === "readonly" && <ExpirationBanner />}
      {children}
    </WorkspaceProvider>
  );
}