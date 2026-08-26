"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAIObservability } from "@/hooks/use-admin-ai-observability";
import { useAdminAICreditOperation } from "@/hooks/use-admin-ai-credit-operations";
import { useAdminTenants } from "@/hooks/use-admin-tenants";
import { qs } from "@/lib/financial/http";
import { toastError, toastSuccess } from "@/lib/toast";

export default function AdminBillingPage() {
  const t = useTranslations("admin.pages.billing");
  const [filters, setFilters] = useState<{
    from?: Date;
    to?: Date;
    planId?: string;
    provider?: string;
    model?: string;
    tenantId?: string;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000),
    to: new Date(),
  });
  const { data, isLoading, isError } = useAdminAIObservability(filters);
  const { data: tenants, isLoading: isLoadingTenants } = useAdminTenants();
  const creditOperation = useAdminAICreditOperation();
  const [manualTenantId, setManualTenantId] = useState("");
  const [operation, setOperation] = useState<"grant" | "revoke" | "adjustment">(
    "grant",
  );
  const [pool, setPool] = useState<
    "promotional" | "subscription" | "purchased"
  >("promotional");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [campaign, setCampaign] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const set = (key: "provider" | "model" | "tenantId", value: string) =>
    setFilters((current) => ({ ...current, [key]: value || undefined }));

  function submitCreditOperation(event: React.FormEvent) {
    event.preventDefault();
    const tenantId = manualTenantId;
    const amount = Number(quantity);
    if (
      !tenantId ||
      !Number.isSafeInteger(amount) ||
      amount === 0 ||
      !reason.trim() ||
      (operation === "grant" && !campaign.trim())
    )
      return;
    if (operation === "revoke" && !window.confirm(t("confirmRevoke"))) return;
    creditOperation.mutate(
      {
        tenantId,
        operation,
        pool,
        quantity: amount,
        reason: reason.trim(),
        ...(campaign.trim() ? { campaign: campaign.trim() } : {}),
        ...(expiresAt
          ? { expiresAt: new Date(`${expiresAt}T23:59:59.999`).toISOString() }
          : {}),
      },
      {
        onSuccess: () => {
          toastSuccess(t("creditOperationSuccess"));
          setQuantity("");
          setReason("");
          setCampaign("");
          setExpiresAt("");
        },
        onError: () => toastError(t("creditOperationError")),
      },
    );
  }

  return (
    <div className="p-6" data-testid="admin-billing-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            {t("title")}
          </h1>
          <p className="text-sm text-text-secondary">{t("description")}</p>
        </div>
        <Button asChild variant="outline">
          <a
            href={`/api/admin/ai-observability${qs({ from: filters.from?.toISOString(), to: filters.to?.toISOString(), planId: filters.planId, provider: filters.provider, model: filters.model, tenantId: filters.tenantId, format: "csv" })}`}
          >
            <Download className="mr-2 h-4 w-4" />
            {t("export")}
          </a>
        </Button>
      </div>
      <div className="mt-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-3 lg:grid-cols-6">
        <Input
          type="date"
          aria-label={t("from")}
          value={filters.from?.toISOString().slice(0, 10) ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              from: event.target.value
                ? new Date(`${event.target.value}T00:00:00`)
                : undefined,
            }))
          }
        />
        <Input
          type="date"
          aria-label={t("to")}
          value={filters.to?.toISOString().slice(0, 10) ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              to: event.target.value
                ? new Date(`${event.target.value}T23:59:59.999`)
                : undefined,
            }))
          }
        />
        <Input
          aria-label={t("plan")}
          placeholder={t("plan")}
          value={filters.planId ?? ""}
          onChange={(event) =>
            setFilters((current) => ({
              ...current,
              planId: event.target.value || undefined,
            }))
          }
        />
        <Input
          aria-label={t("provider")}
          placeholder={t("provider")}
          value={filters.provider ?? ""}
          onChange={(event) => set("provider", event.target.value)}
        />
        <Input
          aria-label={t("model")}
          placeholder={t("model")}
          value={filters.model ?? ""}
          onChange={(event) => set("model", event.target.value)}
        />
        <Input
          aria-label={t("tenant")}
          placeholder={t("tenant")}
          value={filters.tenantId ?? ""}
          onChange={(event) => set("tenantId", event.target.value)}
        />
      </div>
      <form
        onSubmit={submitCreditOperation}
        className="mt-6 grid gap-3 rounded-lg border border-border p-4 md:grid-cols-2 lg:grid-cols-4"
        data-testid="manual-credit-operation-form"
      >
        <div className="lg:col-span-4">
          <h2 className="font-semibold text-text-primary">
            {t("manualCreditsTitle")}
          </h2>
          <p className="text-sm text-text-secondary">
            {t("manualCreditsDescription")}
          </p>
        </div>
        <select
          aria-label={t("company")}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={manualTenantId}
          onChange={(event) => setManualTenantId(event.target.value)}
          required
          disabled={isLoadingTenants}
        >
          <option value="">
            {isLoadingTenants ? t("loadingCompanies") : t("selectCompany")}
          </option>
          {tenants?.map((tenant) => (
            <option value={tenant.id} key={tenant.id}>
              {tenant.name} ({tenant.slug})
            </option>
          ))}
        </select>
        <select
          aria-label={t("operation")}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={operation}
          onChange={(event) => {
            const nextOperation = event.target.value as typeof operation;
            setOperation(nextOperation);
            if (nextOperation === "grant") setPool("promotional");
          }}
        >
          <option value="grant">{t("grant")}</option>
          <option value="revoke">{t("revoke")}</option>
          <option value="adjustment">{t("adjustment")}</option>
        </select>
        <select
          aria-label={t("pool")}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm"
          value={pool}
          onChange={(event) => setPool(event.target.value as typeof pool)}
        >
          <option value="promotional">{t("promotional")}</option>
          <option value="subscription" disabled={operation === "grant"}>
            {t("subscription")}
          </option>
          <option value="purchased" disabled={operation === "grant"}>
            {t("purchased")}
          </option>
        </select>
        <Input
          aria-label={t("quantity")}
          placeholder={t("quantity")}
          type="number"
          step="1"
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          required
        />
        <Input
          aria-label={t("reason")}
          placeholder={t("reason")}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          required
          className="lg:col-span-2"
        />
        <Input
          aria-label={t("campaign")}
          placeholder={t("campaign")}
          value={campaign}
          onChange={(event) => setCampaign(event.target.value)}
          required={operation === "grant"}
        />
        <Input
          aria-label={t("expiresAt")}
          type="date"
          value={expiresAt}
          onChange={(event) => setExpiresAt(event.target.value)}
        />
        <div className="lg:col-span-4">
          <Button type="submit" disabled={creditOperation.isPending}>
            {t("applyCreditOperation")}
          </Button>
        </div>
      </form>
      {isLoading && (
        <p className="mt-6 text-sm text-text-secondary">{t("loading")}</p>
      )}
      {isError && <p className="mt-6 text-sm text-danger">{t("error")}</p>}
      {data && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [t("grants"), data.summary.grants],
              [t("consumed"), data.summary.consumed],
              [t("cycles"), data.summary.cycles],
              [t("failures"), data.summary.failedEvents],
              [t("refunds"), data.summary.refunds],
              [t("expired"), data.summary.expired],
              [
                t("providerCost"),
                `${(data.summary.providerCostMicros / 1_000_000).toFixed(4)}`,
              ],
              [
                t("margin"),
                data.summary.estimatedMarginCents == null
                  ? t("unavailable")
                  : `${(data.summary.estimatedMarginCents / 100).toFixed(2)}`,
              ],
            ].map(([label, value]) => (
              <div
                className="rounded-lg border border-border p-4"
                key={String(label)}
              >
                <div className="text-xs uppercase tracking-wide text-text-secondary">
                  {label}
                </div>
                <div className="mt-1 text-xl font-semibold text-text-primary">
                  {value}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-lg border border-border p-4">
            <h2 className="font-semibold">{t("tokens")}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {t("actual")}:{" "}
              {data.summary.actualInputTokens + data.summary.actualOutputTokens}{" "}
              · {t("estimated")}:{" "}
              {data.summary.estimatedInputTokens +
                data.summary.estimatedOutputTokens}
            </p>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section>
              <h2 className="mb-2 font-semibold">{t("highUsageTenants")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {data.highUsageTenants.map((row) => (
                      <tr className="border-b border-border" key={row.tenantId}>
                        <td className="py-2">{row.tenantName}</td>
                        <td className="py-2">{row.credits} credits</td>
                        <td className="py-2">{row.requests} requests</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 className="mb-2 font-semibold">{t("highUsageMembers")}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {data.highUsageMembers.map((row) => (
                      <tr
                        className="border-b border-border"
                        key={`${row.tenantId}:${row.actorId}`}
                      >
                        <td className="py-2">{row.tenantName}</td>
                        <td className="py-2">{row.actorId}</td>
                        <td className="py-2">{row.credits} credits</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </>
      )}
      <div className="mt-8 flex items-center gap-2 text-sm text-text-secondary">
        <Wallet className="h-4 w-4" />
        {t("retention")}
      </div>
    </div>
  );
}
