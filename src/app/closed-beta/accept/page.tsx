"use client";

import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Building2 } from "lucide-react";
import { AuthProvider, useAuth } from "@/stores/auth-context";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/shared/loading-state";

export default function ClosedBetaAcceptPage() {
  return (
    <AuthProvider>
      <ClosedBetaAcceptContent />
    </AuthProvider>
  );
}

function ClosedBetaAcceptContent() {
  const t = useTranslations("closedBeta.accept");
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const { user, isLoading } = useAuth();
  const [invitationStatus, setInvitationStatus] = useState<"loading" | "available" | "unavailable">("loading");
  const [consent, setConsent] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setInvitationStatus("unavailable");
      return;
    }
    fetch(`/api/closed-beta/invitations/${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((payload) => {
        setInvitationStatus(payload.data?.status === "available" ? "available" : "unavailable");
      })
      .catch(() => setInvitationStatus("unavailable"));
  }, [token]);

  async function accept() {
    setAccepting(true);
    setError("");
    try {
      const response = await fetch("/api/closed-beta/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consentVersion: "2026-08-17" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error?.message ?? t("acceptFailed"));
      router.replace("/app");
    } catch (acceptError) {
      setError(acceptError instanceof Error ? acceptError.message : t("acceptFailed"));
    } finally {
      setAccepting(false);
    }
  }

  if (isLoading || invitationStatus === "loading") {
    return <LoadingState text={t("checking")} skeleton={false} />;
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

        {invitationStatus === "unavailable" ? (
          <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
            {t("unavailable")}
          </p>
        ) : !user ? (
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">{t("signInHint")}</p>
            <Link
              className="flex h-10 w-full items-center justify-center rounded-md bg-accent px-4 text-sm font-medium text-white hover:bg-accent/90"
              href={`/login?mode=register&closedBetaToken=${encodeURIComponent(token)}`}
            >
              {t("createAccount")}
            </Link>
            <Link
              className="flex h-10 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-text-primary hover:bg-bg-secondary"
              href={`/login?closedBetaToken=${encodeURIComponent(token)}`}
            >
              {t("signIn")}
            </Link>
          </div>
        ) : !user.email_confirmed_at ? (
          <p className="rounded-lg border border-border bg-bg-secondary p-4 text-sm text-text-secondary">
            {t("verifyEmail")}
          </p>
        ) : (
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-accent"
              />
              <span>{t("consent")}</span>
            </label>
            {error && <p className="text-sm text-danger" role="alert">{error}</p>}
            <Button className="w-full" onClick={accept} disabled={!consent || accepting}>
              {accepting ? t("accepting") : t("accept")}
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
