"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useDeleteProposalTemplate,
  useProposalTemplates,
} from "@/hooks/use-proposals";
import { useCan } from "@/hooks/use-permissions";
import { detectVariables } from "@/lib/financial/proposal-variables";
import { toastSuccess } from "@/lib/toast";
import { CivilDateText } from "@/components/financial/shared/civil-date-text";
import { FinancialEmptyState } from "@/components/financial/shared/empty-state";
import { FinancialErrorState } from "@/components/financial/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";

export function ProposalTemplatesList() {
  const router = useRouter();
  const t = useTranslations("proposals.templates");
  const { data, isLoading, isError, refetch } = useProposalTemplates();
  const deleteTemplate = useDeleteProposalTemplate();
  const { can } = useCan();

  function handleDelete(template: { id: string; name: string }) {
    if (!window.confirm(t("confirmDelete", { name: template.name }))) return;
    deleteTemplate.mutate(template.id, {
      onSuccess: () => toastSuccess(t("deleted")),
    });
  }

  if (isLoading) return <LoadingState />;
  if (isError || !data) {
    return (
      <FinancialErrorState
        message={t("loadFailed")}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text-primary">{t("title")}</h1>
        {can("financial.proposals.manageTemplates") && (
          <div className="flex flex-wrap gap-2">
            {can("financial.proposals.generateWithAi") && (
              <Link
                href="/financial/proposals/templates/ai-studio"
                className="flex min-h-[44px] items-center gap-2 rounded-md border border-accent px-3 py-2 text-sm font-medium text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
              >
                <Sparkles size={16} aria-hidden="true" /> {t("aiStudio")}
              </Link>
            )}
            <Link
              href="/financial/proposals/templates/new"
              className="flex min-h-[44px] items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            >
              <Plus size={16} aria-hidden="true" /> {t("newTemplate")}
            </Link>
          </div>
        )}
      </div>

      <p className="text-sm text-text-secondary">{t("subtitle")}</p>

      {data.length === 0 ? (
        <FinancialEmptyState title={t("emptyTitle")} />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("listAria")}>
          {data.map((template) => {
            const variableCount = detectVariables(template.html).length;
            return (
              <li
                key={template.id}
                className="rounded-xl border border-border bg-page-alt p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/financial/proposals/templates/${template.id}`)}
                    className="min-w-0 text-left font-medium text-text-primary hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                  >
                    {template.name}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {can("financial.proposals.manageTemplates") && (
                      <Link
                        href={`/financial/proposals/templates/${template.id}`}
                        aria-label={`${t("editAria")} ${template.name}`}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </Link>
                    )}
                    {can("financial.proposals.manageTemplates") && (
                      <button
                        type="button"
                        onClick={() => handleDelete(template)}
                        aria-label={`${t("deleteAria")} ${template.name}`}
                        className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-secondary hover:text-danger focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-2 text-xs text-text-muted">
                  {t("variableCount", { count: variableCount })}
                </p>
                <p className="text-xs text-text-muted">
                  {t("createdAt")} <CivilDateText date={template.createdAt.slice(0, 10)} />
                </p>
                {can("financial.proposals.create") && (
                <Link
                  href={`/financial/proposals/new?templateId=${template.id}`}
                  className="mt-3 inline-flex text-sm font-medium text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                >
                  {t("useTemplate")}
                </Link>
              )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
