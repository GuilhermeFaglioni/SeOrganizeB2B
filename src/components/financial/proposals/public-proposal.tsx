"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProposalHtmlPreview } from "@/components/financial/proposals/proposal-html-preview";

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
    <main className="min-h-[100dvh] bg-white">
      <header className="relative z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-3">
            {proposal.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={proposal.logoUrl}
                alt={proposal.companyName ?? ""}
                className="h-11 w-11 shrink-0 rounded-xl object-contain"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-sm font-bold text-white shadow-sm">
                {(proposal.companyName ?? "S").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold tracking-tight text-slate-900">
                {proposal.companyName ?? proposal.code}
              </p>
              <p className="text-xs text-slate-500">
                {t("documentLabel")} · {proposal.code}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {t("preparedFor")}
            </p>
            <p className="mt-1 text-sm font-medium text-slate-700">{proposal.clientName}</p>
          </div>
        </div>
      </header>

      <div>
        {proposal.status === "accepted" && (
          <div
            role="status"
            className="border-b border-emerald-200 bg-emerald-50 px-5 py-4 text-center text-sm font-medium text-emerald-800 sm:px-8"
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
            className="border-b border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-medium text-red-800 sm:px-8"
          >
            {t("rejectedBanner")}
            {proposal.rejectedReason && (
              <p className="mt-1 text-xs">{proposal.rejectedReason}</p>
            )}
          </div>
        )}

        <ProposalHtmlPreview
          html={proposal.htmlSnapshot}
          immersive
        />

        {canAccept && !submitting && (
          <section className="bg-[#10233f] text-white">
            <div className="mx-auto grid max-w-7xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(320px,480px)] lg:items-center lg:px-12 lg:py-24">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-blue-300">
                  {t("acceptEyebrow")}
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  {t("acceptTitle")}
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
                  {t("acceptDescription")}
                </p>
              </div>

              <form
                onSubmit={handleAccept}
                className="space-y-4 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur sm:p-7"
              >
                <div className="space-y-2">
                  <Label htmlFor="acceptor-name" className="text-sm text-white">
                    {t("nameLabel")}
                  </Label>
                  <Input
                    id="acceptor-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("namePlaceholder")}
                    className="h-12 border-white/20 bg-white text-slate-900 placeholder:text-slate-400"
                    required
                  />
                </div>
                {error && (
                  <p role="alert" className="text-sm text-red-300">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="h-12 w-full bg-[#2f6fed] text-base font-semibold text-white hover:bg-[#245fd1]"
                >
                  {submitting ? t("accepting") : t("accept")}
                </Button>
                <p className="text-xs leading-5 text-slate-400">{t("acceptConsent")}</p>
              </form>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
