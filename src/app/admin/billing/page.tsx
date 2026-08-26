"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAIObservability } from "@/hooks/use-admin-ai-observability";
import { qs } from "@/lib/financial/http";

export default function AdminBillingPage() {
  const t = useTranslations("admin.pages.billing");
  const [filters, setFilters] = useState<{ from?: Date; to?: Date; planId?: string; provider?: string; model?: string; tenantId?: string }>({ from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000), to: new Date() });
  const { data, isLoading, isError } = useAdminAIObservability(filters);
  const set = (key: "provider" | "model" | "tenantId", value: string) => setFilters((current) => ({ ...current, [key]: value || undefined }));

  return (
    <div className="p-6" data-testid="admin-billing-page">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-text-primary">{t("title")}</h1><p className="text-sm text-text-secondary">{t("description")}</p></div><Button asChild variant="outline"><a href={`/api/admin/ai-observability${qs({ from: filters.from?.toISOString(), to: filters.to?.toISOString(), planId: filters.planId, provider: filters.provider, model: filters.model, tenantId: filters.tenantId, format: "csv" })}`}><Download className="mr-2 h-4 w-4" />{t("export")}</a></Button></div>
      <div className="mt-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-3 lg:grid-cols-6"><Input type="date" aria-label={t("from")} value={filters.from?.toISOString().slice(0, 10) ?? ""} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value ? new Date(`${event.target.value}T00:00:00`) : undefined }))} /><Input type="date" aria-label={t("to")} value={filters.to?.toISOString().slice(0, 10) ?? ""} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value ? new Date(`${event.target.value}T23:59:59.999`) : undefined }))} /><Input aria-label={t("plan")} placeholder={t("plan")} value={filters.planId ?? ""} onChange={(event) => setFilters((current) => ({ ...current, planId: event.target.value || undefined }))} /><Input aria-label={t("provider")} placeholder={t("provider")} value={filters.provider ?? ""} onChange={(event) => set("provider", event.target.value)} /><Input aria-label={t("model")} placeholder={t("model")} value={filters.model ?? ""} onChange={(event) => set("model", event.target.value)} /><Input aria-label={t("tenant")} placeholder={t("tenant")} value={filters.tenantId ?? ""} onChange={(event) => set("tenantId", event.target.value)} /></div>
      {isLoading && <p className="mt-6 text-sm text-text-secondary">{t("loading")}</p>}
      {isError && <p className="mt-6 text-sm text-danger">{t("error")}</p>}
      {data && <>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[[t("grants"), data.summary.grants], [t("consumed"), data.summary.consumed], [t("cycles"), data.summary.cycles], [t("failures"), data.summary.failedEvents], [t("refunds"), data.summary.refunds], [t("expired"), data.summary.expired], [t("providerCost"), `${(data.summary.providerCostMicros / 1_000_000).toFixed(4)}`], [t("margin"), data.summary.estimatedMarginCents == null ? t("unavailable") : `${(data.summary.estimatedMarginCents / 100).toFixed(2)}`]].map(([label, value]) => <div className="rounded-lg border border-border p-4" key={String(label)}><div className="text-xs uppercase tracking-wide text-text-secondary">{label}</div><div className="mt-1 text-xl font-semibold text-text-primary">{value}</div></div>)}</div>
        <div className="mt-6 rounded-lg border border-border p-4"><h2 className="font-semibold">{t("tokens")}</h2><p className="mt-2 text-sm text-text-secondary">{t("actual")}: {data.summary.actualInputTokens + data.summary.actualOutputTokens} · {t("estimated")}: {data.summary.estimatedInputTokens + data.summary.estimatedOutputTokens}</p></div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2"><section><h2 className="mb-2 font-semibold">{t("highUsageTenants")}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{data.highUsageTenants.map((row) => <tr className="border-b border-border" key={row.tenantId}><td className="py-2">{row.tenantName}</td><td className="py-2">{row.credits} credits</td><td className="py-2">{row.requests} requests</td></tr>)}</tbody></table></div></section><section><h2 className="mb-2 font-semibold">{t("highUsageMembers")}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><tbody>{data.highUsageMembers.map((row) => <tr className="border-b border-border" key={`${row.tenantId}:${row.actorId}`}><td className="py-2">{row.tenantName}</td><td className="py-2">{row.actorId}</td><td className="py-2">{row.credits} credits</td></tr>)}</tbody></table></div></section></div>
      </>}
      <div className="mt-8 flex items-center gap-2 text-sm text-text-secondary"><Wallet className="h-4 w-4" />{t("retention")}</div>
    </div>
  );
}
