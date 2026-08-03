"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PublicProposalData {
  status: string;
  htmlSnapshot: string;
  title: string;
  code: string;
  clientName: string;
  companyName: string | null;
  logoUrl: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  locale: string;
}

export function PublicProposalUnavailable() {
  const t = useTranslations("proposals.public");
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-page p-6">
      <div className="rounded-xl border border-border bg-page-alt p-8 text-center">
        <p className="text-sm text-text-muted">{t("unavailable")}</p>
      </div>
    </main>
  );
}

export function PublicProposalView({
  proposal,
  token,
}: {
  proposal: PublicProposalData;
  token: string;
}) {
  const t = useTranslations("proposals.public");
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canAccept = proposal.status === "sent" || proposal.status === "viewed";

  async function handleAccept(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`/api/p/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const json = await response.json();
      if (json.error) throw new Error(json.error.message);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("acceptFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-page">
      <header className="border-b border-border bg-page-alt/95">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {proposal.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proposal.logoUrl}
                alt={proposal.companyName ?? ""}
                className="h-10 w-10 shrink-0 rounded-lg object-contain"
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
                {(proposal.companyName ?? "S").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">
                {proposal.companyName ?? proposal.code}
              </p>
              <p className="text-xs text-text-muted">{proposal.code}</p>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            {t("for")} {proposal.clientName}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{proposal.title}</h1>
        </div>

        {proposal.status === "accepted" && (
          <div
            role="status"
            className="rounded-xl border border-success/40 bg-success-bg p-4 text-sm text-success"
          >
            {t("acceptedBanner", {
              name: proposal.acceptedByName ?? "",
              date: proposal.acceptedAt ?? "",
            })}
          </div>
        )}

        {proposal.status === "rejected" && (
          <div
            role="status"
            className="rounded-xl border border-danger/40 bg-danger-bg p-4 text-sm text-danger"
          >
            {t("rejectedBanner")}
            {proposal.rejectedReason && (
              <p className="mt-1 text-xs">{proposal.rejectedReason}</p>
            )}
          </div>
        )}

        <article className="prose max-w-none rounded-xl border border-border bg-white p-6 text-text-primary shadow-sm">
          <div dangerouslySetInnerHTML={{ __html: proposal.htmlSnapshot }} />
        </article>

        {canAccept && !submitting && (
          <form
            onSubmit={handleAccept}
            className="rounded-xl border border-border bg-page-alt p-4 space-y-3"
          >
            <p className="text-sm font-medium text-text-primary">{t("acceptTitle")}</p>
            <div className="space-y-2">
              <Label htmlFor="acceptor-name">{t("nameLabel")}</Label>
              <Input
                id="acceptor-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t("namePlaceholder")}
                required
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? t("accepting") : t("accept")}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
