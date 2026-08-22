"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/stores/auth-context";
import { useProfile } from "@/hooks/use-profile";
import { useOnboardingStatus } from "@/hooks/use-onboarding-status";
import { useWorkspace, type WorkspaceData } from "@/hooks/use-workspace";
import { useCheckinStatus } from "@/hooks/use-checkin";
import { WorkspaceProvider } from "@/stores/workspace-context";
import { GracePeriodBanner } from "@/components/billing/grace-period-banner";
import { UpgradeBanner } from "@/components/billing/upgrade-banner";
  import { ExpirationBanner } from "@/components/billing/expiration-banner";
  import { CheckinReminderBanner } from "@/components/beta/checkin-reminder-banner";
  import { LoadingState } from "@/components/shared/loading-state";
  import { Button } from "@/components/ui/button";
import { getWorkspaceAccessMode } from "@/lib/workspace/access";
import {
  pushWithAIStudioGuard,
  replaceWithAIStudioGuard,
  shouldPreserveAIStudioParentChildren,
} from "@/lib/ai/studio-router-guard";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const authReady = !isLoading && Boolean(user);
  const onboardingQuery = useOnboardingStatus({ enabled: authReady });
  const onboardingStatus = onboardingQuery.data?.status;
  const needsBinding =
    onboardingStatus === "binding_required" ||
    onboardingStatus === "binding_setup_required";
  const profileQuery = useProfile(user?.id, {
    enabled:
      authReady &&
      onboardingQuery.isSuccess &&
      (onboardingStatus === "ready" ||
        onboardingStatus === "workspace_creation_required"),
  });
  const workspaceQuery = useWorkspace({ enabled: authReady && profileQuery.isSuccess });
  const { refetch: refetchWorkspace } = workspaceQuery;
  const checkinQuery = useCheckinStatus({
    enabled: authReady && profileQuery.isSuccess && workspaceQuery.isSuccess,
  });
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations("auth.login");

  const mode = getWorkspaceAccessMode(workspaceQuery.data);
  const checkinBlocked = checkinQuery.data?.blocked === true;
  const checkinReminder = checkinQuery.data && !checkinBlocked && checkinQuery.data.phase === "open" && checkinQuery.data.workspaceStatus === "pending" && !checkinQuery.data.memberSubmitted;
  const [redirecting, setRedirecting] = useState(false);
  const [workspaceReadyForUser, setWorkspaceReadyForUser] = useState<string | null>(null);
  const hasRenderedChildren = useRef(false);
  const previousWorkspace = useRef<WorkspaceData | null>(null);
  const previousMode = useRef(mode);
  const renderedUserId = useRef<string | null>(null);
  const renderedWorkspaceId = useRef<string | null>(null);
  const workspaceRequestUserId = useRef<string | null>(null);
  if (renderedUserId.current !== null && renderedUserId.current !== user?.id) {
    previousWorkspace.current = null;
    previousMode.current = "active";
  }
  if (workspaceQuery.data) {
    previousWorkspace.current = workspaceQuery.data;
    previousMode.current = mode;
  }
  const preservedWorkspace = workspaceQuery.data ?? previousWorkspace.current;
  const preservedMode = workspaceQuery.data ? mode : previousMode.current;
  const redirectHref = !isLoading && !user
    ? "/login"
    : user && needsBinding && pathname !== "/onboarding/bind"
      ? "/onboarding/bind"
      : user && !workspaceQuery.isLoading && mode === "expired" && pathname !== "/expired"
        ? "/expired"
        : user && checkinBlocked && pathname !== "/beta/checkin"
          ? "/beta/checkin"
          : null;
  const redirectMethod = redirectHref === "/login" ? "push" : redirectHref ? "replace" : null;
  const readOnly = preservedMode === "readonly";
  const content = (
    <WorkspaceProvider workspace={preservedWorkspace} readOnly={readOnly}>
      {preservedMode === "grace" && <GracePeriodBanner />}
      {checkinReminder && pathname !== "/beta/checkin" && <CheckinReminderBanner />}
      <UpgradeBanner />
      {preservedMode === "readonly" && <ExpirationBanner />}
      {children}
    </WorkspaceProvider>
  );

  useEffect(() => {
    if (!user) {
      workspaceRequestUserId.current = null;
      setWorkspaceReadyForUser(null);
      return;
    }
    if (!profileQuery.isSuccess || workspaceRequestUserId.current === user.id) return;
    workspaceRequestUserId.current = user.id;
    setWorkspaceReadyForUser(null);
    void refetchWorkspace().then(({ data }) => {
      if (workspaceRequestUserId.current === user.id && data) setWorkspaceReadyForUser(user.id);
    }).catch(() => {
      if (workspaceRequestUserId.current === user.id) workspaceRequestUserId.current = null;
    });
  }, [profileQuery.isSuccess, refetchWorkspace, user, workspaceQuery.isError]);

  useEffect(() => {
    if (!redirectHref || !redirectMethod) {
      setRedirecting(false);
      return;
    }
    const scheduled = redirectMethod === "push"
      ? pushWithAIStudioGuard(router, redirectHref)
      : replaceWithAIStudioGuard(router, redirectHref);
    setRedirecting(scheduled);
  }, [redirectHref, redirectMethod, router]);

  const preserveMountedContent = shouldPreserveAIStudioParentChildren({
    hasRenderedChildren: hasRenderedChildren.current,
    redirecting,
    sameIdentity: Boolean(
      user &&
      renderedUserId.current === user.id &&
      workspaceReadyForUser === user.id &&
      (!workspaceQuery.data || workspaceQuery.data.id === renderedWorkspaceId.current),
    ),
  });

  if (isLoading) {
    return preserveMountedContent ? content : <LoadingState text={t("checkingAuth")} />;
  }

  if (!user) {
    return preserveMountedContent ? content : null;
  }

  if (onboardingQuery.isLoading) {
    return preserveMountedContent ? content : <LoadingState text={t("checkingWorkspace")} />;
  }

  if (onboardingQuery.isError) {
    return preserveMountedContent ? content : (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-body text-text-secondary">{t("workspaceLoadFailed")}</p>
        <Button type="button" onClick={() => onboardingQuery.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (needsBinding) {
    return preserveMountedContent ? content : <LoadingState text={t("checkingWorkspace")} />;
  }

  if (profileQuery.isLoading) {
    return preserveMountedContent ? content : <LoadingState text={t("checkingWorkspace")} />;
  }

  if (profileQuery.isError) {
    return preserveMountedContent ? content : (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-body text-text-secondary">{t("workspaceLoadFailed")}</p>
        <Button type="button" onClick={() => profileQuery.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (workspaceQuery.isLoading) {
    return preserveMountedContent ? content : <LoadingState text={t("checkingWorkspace")} />;
  }

  if (workspaceQuery.isError) {
    return preserveMountedContent ? content : (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-body text-text-secondary">{t("workspaceLoadFailed")}</p>
        <Button type="button" onClick={() => workspaceQuery.refetch()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (
    workspaceQuery.isSuccess &&
    checkinQuery.isLoading &&
    pathname !== "/beta/checkin"
  ) {
    return preserveMountedContent ? content : <LoadingState text={t("checkingWorkspace")} />;
  }

  if (redirecting || workspaceReadyForUser !== user?.id) {
    return <LoadingState text={t("checkingWorkspace")} />;
  }
  hasRenderedChildren.current = true;
  renderedUserId.current = user?.id ?? null;
  renderedWorkspaceId.current = preservedWorkspace?.id ?? null;
  return content;
}
