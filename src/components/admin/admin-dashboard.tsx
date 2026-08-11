"use client";

import { useTranslations } from "next-intl";
import { Building2, FileText, Users } from "lucide-react";

interface AdminDashboardProps {
  totalWorkspaces: number;
  totalProfiles: number;
  totalPlans: number;
}

export function AdminDashboard({
  totalWorkspaces,
  totalProfiles,
  totalPlans,
}: AdminDashboardProps) {
  const t = useTranslations("admin.pages.dashboard");

  const metrics = [
    { key: "workspaces", label: t("totalWorkspaces"), value: totalWorkspaces, icon: Building2 },
    { key: "profiles", label: t("totalProfiles"), value: totalProfiles, icon: Users },
    { key: "plans", label: t("totalPlans"), value: totalPlans, icon: FileText },
  ];

  return (
    <div data-testid="admin-dashboard-page" className="p-6">
      <h1 className="text-heading-1 font-semibold text-text-primary">
        {t("title")}
      </h1>
      <p className="mt-1 text-body-small text-text-secondary">
        {t("metricsLabel")}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.key}
              data-testid={`admin-metric-${metric.key}`}
              className="rounded-xl border border-border bg-page-alt p-5 shadow-card"
            >
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <span className="text-sm text-text-secondary">
                  {metric.label}
                </span>
              </div>
              <p className="text-heading-1 font-semibold text-text-primary">
                {metric.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
