"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Briefcase, DollarSign, FileText, Clock, AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTodayBusiness } from "@/hooks/use-today-business";
import { LoadingState } from "@/components/shared/loading-state";
import { Button } from "@/components/ui/button";

const METRICS = [
  {
    key: "receivablesThisWeek" as const,
    icon: DollarSign,
    color: "text-success",
    bg: "bg-success-bg",
    link: "/financial/overview",
    linkKey: "viewContracts",
  },
  {
    key: "openProposals" as const,
    icon: FileText,
    color: "text-accent",
    bg: "bg-accent-bg",
    link: "/financial/proposals",
    linkKey: "viewProposals",
  },
  {
    key: "expiringContracts" as const,
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning-bg",
    link: "/financial/contracts",
    linkKey: "viewContracts",
  },
  {
    key: "overdueTasks" as const,
    icon: AlertTriangle,
    color: "text-danger",
    bg: "bg-danger-bg",
    link: "/board?filter=overdue",
    linkKey: "viewTasks",
  },
];

export function TodayBusiness() {
  const t = useTranslations("today.business");
  const router = useRouter();
  const { data, isLoading, error, refetch } = useTodayBusiness();

  return (
    <section
      className="rounded-2xl border border-border bg-page-alt p-5 shadow-card"
      aria-label={t("heading")}
    >
      <div className="mb-4 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-accent" />
        <h3 className="text-heading-1 text-text-primary">{t("heading")}</h3>
      </div>

      {isLoading && <LoadingState />}
      {error && (
        <div className="flex items-center justify-between rounded-xl bg-danger-bg p-3 text-sm text-danger">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {t("loadFailed")}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {!isLoading && !error && !data && (
        <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-text-secondary">
          {t("empty")}
        </p>
      )}

      {data && (
        <div className="grid gap-3 sm:grid-cols-2">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            const value = data[metric.key];
            const displayValue =
              metric.key === "receivablesThisWeek"
                ? `R$ ${value}`
                : String(value);
            return (
              <button
                key={metric.key}
                onClick={() => router.push(metric.link)}
                className="group flex items-center gap-3 rounded-xl border border-border bg-page p-3 text-left transition-colors hover:border-accent"
              >
                <div className={`rounded-lg p-2 ${metric.bg}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-text-secondary">
                    {t(metric.key)}
                  </p>
                  <p className="text-lg font-semibold text-text-primary">
                    {displayValue}
                  </p>
                </div>
                <span className="text-xs text-text-muted opacity-0 transition-opacity group-hover:opacity-100">
                  {t(metric.linkKey)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
