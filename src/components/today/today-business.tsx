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
    color: "text-balsa-success",
    bg: "bg-balsa-success/10",
    link: "/financial/overview",
    linkKey: "viewContracts",
  },
  {
    key: "openProposals" as const,
    icon: FileText,
    color: "text-balsa-primary",
    bg: "bg-balsa-primary/10",
    link: "/financial/proposals",
    linkKey: "viewProposals",
  },
  {
    key: "expiringContracts" as const,
    icon: Clock,
    color: "text-balsa-warning",
    bg: "bg-balsa-warning/10",
    link: "/financial/contracts",
    linkKey: "viewContracts",
  },
  {
    key: "overdueTasks" as const,
    icon: AlertTriangle,
    color: "text-balsa-destructive",
    bg: "bg-balsa-destructive/10",
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
      className="balsa-surface rounded-balsa-panel p-5"
      aria-label={t("heading")}
    >
      <div className="mb-4 flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-balsa-primary" />
        <h3 className="font-balsa-title text-lg font-semibold text-balsa-foreground">{t("heading")}</h3>
      </div>

      {isLoading && <LoadingState />}
      {error && (
        <div className="flex items-center justify-between rounded-balsa-control bg-balsa-destructive/10 p-3 text-sm text-balsa-destructive">
          <span className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> {t("loadFailed")}
          </span>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {!isLoading && !error && !data && (
        <p className="rounded-balsa-surface border border-dashed border-balsa-border py-10 text-center text-sm text-balsa-muted-foreground">
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
              <Button
                key={metric.key}
                type="button"
                variant="glass"
                color="neutral"
                onClick={() => router.push(metric.link)}
                className="group h-auto min-h-16 w-full justify-start rounded-balsa-surface border-balsa-border bg-balsa-background/70 p-3 text-left hover:border-balsa-primary"
              >
                <div className={`rounded-balsa-control p-2 ${metric.bg}`}>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-balsa-xs text-balsa-muted-foreground">
                    {t(metric.key)}
                  </p>
                    <p className="font-balsa-title text-lg font-semibold text-balsa-foreground">
                    {displayValue}
                  </p>
                </div>
                  <span className="text-balsa-xs text-balsa-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                  {t(metric.linkKey)}
                </span>
              </Button>
            );
          })}
        </div>
      )}
    </section>
  );
}
