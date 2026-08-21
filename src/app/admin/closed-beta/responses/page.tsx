"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, ShieldCheck } from "lucide-react";
import { useAdminCheckinEditions } from "@/hooks/use-checkin-admin";
import {
  useCheckinEditionMetrics,
  useCheckinResponseGrouping,
  useCheckinResponses,
  useExportCheckinResponses,
  useGrantCheckinExemption,
  useResetCheckinResponse,
  useRevokeCheckinExemption,
} from "@/hooks/use-checkin-responses-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toastSuccess } from "@/lib/toast";

function statusLabel(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    completed: t("completed"),
    pending: t("pending"),
    exempt: t("exempt"),
    not_applicable: t("not_applicable"),
  };
  return map[status] ?? status;
}

function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminResponsesPage() {
  const t = useTranslations("admin.pages.responses");
  const editions = useAdminCheckinEditions();
  const [editionId, setEditionId] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "grouped" | "metrics">("list");
  const [workspaceFilter, setWorkspaceFilter] = useState("");
  const [themeFilter, setThemeFilter] = useState("");

  const responses = useCheckinResponses(
    editionId,
    { workspaceId: workspaceFilter || undefined, theme: themeFilter || undefined },
  );
  const grouped = useCheckinResponseGrouping(editionId);
  const metrics = useCheckinEditionMetrics(editionId);
  const grantExemption = useGrantCheckinExemption(editionId ?? "");
  const revokeExemption = useRevokeCheckinExemption(editionId ?? "");
  const resetResponse = useResetCheckinResponse(editionId ?? "");
  const exporter = useExportCheckinResponses();

  const [grantWorkspaceId, setGrantWorkspaceId] = useState("");
  const [grantReason, setGrantReason] = useState("");
  const [grantExpiresAt, setGrantExpiresAt] = useState("");

  function submitGrant(event: React.FormEvent) {
    event.preventDefault();
    if (!editionId || !grantWorkspaceId || !grantReason.trim() || !grantExpiresAt) return;
    grantExemption.mutate(
      {
        workspaceId: grantWorkspaceId,
        reason: grantReason.trim(),
        expiresAt: new Date(grantExpiresAt).toISOString(),
      },
      {
        onSuccess: () => {
          toastSuccess(t("grantExemption"));
          setGrantWorkspaceId("");
          setGrantReason("");
          setGrantExpiresAt("");
        },
      },
    );
  }

  async function handleExport() {
    if (!editionId) return;
    const rows = await exporter.exportCsv(editionId);
    if (rows && rows.length > 0) {
      downloadCsv(`checkin-${editionId}.csv`, rows as unknown as Record<string, unknown>[]);
    }
  }

  if (editions.isLoading) {
    return (
      <div className="p-6" data-testid="admin-responses-page">
        <LoadingState />
      </div>
    );
  }

  if (editions.isError || !editions.data) {
    return (
      <div className="p-6" data-testid="admin-responses-page">
        <EmptyState icon={ShieldCheck} title={t("title")} description={t("loadFailed")} />
      </div>
    );
  }

  return (
    <div className="p-6" data-testid="admin-responses-page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-heading-1 font-semibold text-text-primary">{t("title")}</h1>
          <p className="mt-1 text-body-small text-text-secondary">{t("description")}</p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-lg border border-border p-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="responses-edition">{t("selectEdition")}</Label>
            <select
              id="responses-edition"
              value={editionId ?? ""}
              onChange={(event) => setEditionId(event.target.value || null)}
              className="h-10 w-full rounded-md border border-border bg-page px-3 text-sm text-text-primary"
            >
              <option value="">{t("selectEdition")}</option>
              {editions.data.map((edition) => (
                <option key={edition.id} value={edition.id}>
                  {edition.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responses-workspace">{t("company")}</Label>
            <Input
              id="responses-workspace"
              value={workspaceFilter}
              onChange={(event) => setWorkspaceFilter(event.target.value)}
              placeholder={t("company")}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="responses-theme">{t("grouped")}</Label>
            <Input
              id="responses-theme"
              value={themeFilter}
              onChange={(event) => setThemeFilter(event.target.value)}
              placeholder="theme"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["list", "grouped", "metrics"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={mode === item ? "default" : "outline"}
              onClick={() => setMode(item)}
            >
              {t(item === "list" ? "table" : item === "grouped" ? "grouped" : "metrics")}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!editionId}>
            <Download className="mr-2 h-4 w-4" />
            {t("export")}
          </Button>
        </div>
      </div>

      {!editionId ? (
        <div className="mt-6">
          <EmptyState icon={ShieldCheck} title={t("selectEdition")} description={t("description")} />
        </div>
      ) : mode === "metrics" ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
            <p className="text-sm text-text-secondary">{t("completionRate")}</p>
            <p className="mt-2 text-heading-1 font-semibold text-text-primary">
              {metrics.data?.completionRate == null ? "—" : `${metrics.data.completionRate}%`}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
            <p className="text-sm text-text-secondary">{t("totalWorkspaces")}</p>
            <p className="mt-2 text-heading-1 font-semibold text-text-primary">
              {metrics.data?.totalWorkspaces ?? "—"} · {metrics.data?.completed ?? 0} {t("completed")} · {metrics.data?.pending ?? 0} {t("pending")} · {metrics.data?.exempt ?? 0} {t("exempt")}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-page-alt p-5 shadow-card">
            <p className="text-sm text-text-secondary">{t("responseTime")}</p>
            <p className="mt-2 text-heading-1 font-semibold text-text-primary">
              {metrics.data?.averageResponseSeconds == null ? "—" : `${Math.round(metrics.data.averageResponseSeconds)}s`}
            </p>
          </div>
        </div>
      ) : mode === "grouped" ? (
        <div className="mt-6 space-y-4">
          {grouped.isLoading ? (
            <LoadingState />
          ) : grouped.data && grouped.data.length > 0 ? (
            grouped.data.map((question) => (
              <div key={question.questionId} className="rounded-lg border border-border p-4">
                <p className="font-medium text-text-primary">{question.text}</p>
                <p className="text-xs text-text-secondary">
                  {question.type}
                  {question.theme ? ` · ${question.theme}` : ""} · {question.responses.length} respostas
                </p>
                <ul className="mt-2 list-inside list-disc text-sm text-text-secondary">
                  {question.responses.map((entry) => (
                    <li key={`${question.questionId}-${entry.workspaceId}`}>
                      {entry.workspaceName}: {Array.isArray(entry.value) ? entry.value.join(", ") : String(entry.value)}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-secondary">{t("noResponses")}</p>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {responses.isLoading ? (
            <LoadingState />
          ) : responses.data && responses.data.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-page text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3 font-medium">{t("company")}</th>
                    <th className="px-4 py-3 font-medium">{t("responder")}</th>
                    <th className="px-4 py-3 font-medium">{t("date")}</th>
                    <th className="px-4 py-3 font-medium">{t("status")}</th>
                    <th className="px-4 py-3 font-medium">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.data.map((response) => (
                    <tr key={response.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium text-text-primary">{response.workspaceName}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {response.responderName || response.responderEmail}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {new Date(response.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">
                        {statusLabel(response.workspaceStatus, t)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {response.workspaceStatus === "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                if (window.confirm(t("resetConfirm"))) resetResponse.mutate(response.workspaceId);
                              }}
                              disabled={resetResponse.isPending}
                            >
                              {t("resetResponse")}
                            </Button>
                          )}
                          {response.workspaceStatus === "exempt" ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => revokeExemption.mutate(response.workspaceId)}
                              disabled={revokeExemption.isPending}
                            >
                              {t("revokeExemption")}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setGrantWorkspaceId(response.workspaceId);
                              }}
                            >
                              {t("grantExemption")}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">{t("noResponses")}</p>
          )}
        </div>
      )}

      {editionId && grantWorkspaceId && (
        <form
          onSubmit={submitGrant}
          className="mt-6 space-y-4 rounded-lg border border-dashed border-border p-4"
          data-testid="grant-exemption-form"
        >
          <h2 className="text-heading-2 font-semibold text-text-primary">{t("grantExemption")}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t("company")}</Label>
              <Input value={grantWorkspaceId} readOnly />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exemption-reason">{t("reason")}</Label>
              <Input
                id="exemption-reason"
                value={grantReason}
                onChange={(event) => setGrantReason(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exemption-expires">{t("expiresAt")}</Label>
              <Input
                id="exemption-expires"
                type="date"
                value={grantExpiresAt}
                onChange={(event) => setGrantExpiresAt(event.target.value)}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={grantExemption.isPending}>
              {t("grantExemption")}
            </Button>
            <Button type="button" variant="outline" onClick={() => setGrantWorkspaceId("")}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
