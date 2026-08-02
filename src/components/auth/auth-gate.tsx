"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/stores/auth-context";
import { LoadingState } from "@/components/shared/loading-state";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations("auth.login");

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return <LoadingState text={t("checkingAuth")} />;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}
