"use client";

import { TodayTasks } from "@/components/today/today-tasks";
import { TodayAgenda } from "@/components/today/today-agenda";
import { TodayActivity } from "@/components/today/today-activity";
import { TodayBusiness } from "@/components/today/today-business";
import { useNotifications } from "@/hooks/use-notifications";
import { TodaySavedViews } from "@/components/today/today-saved-views";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { useTranslations } from "next-intl";

export default function AuthenticatedHome() {
  const t = useTranslations("today.page");
  const { data: notifications } = useNotifications();
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="h-full min-h-0 overflow-y-auto p-5" data-testid="today-page">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-label uppercase tracking-[0.12em] text-text-muted">
              {t("executiveCockpit")}
            </p>
            <h2 className="text-display capitalize text-text-primary">{today}</h2>
          </div>
          <div
            className="rounded-full border border-border bg-page-alt px-3 py-1.5 text-xs font-medium text-text-secondary shadow-card"
            aria-live="polite"
          >
            {t("unreadNotifications", { count: notifications?.unreadCount ?? 0 })}
          </div>
        </div>
        <OnboardingWizard />
        <TodaySavedViews />
        <TodayBusiness />
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <TodayTasks />
          <TodayAgenda />
          <div className="xl:col-span-2">
            <TodayActivity />
          </div>
        </div>
      </div>
    </div>
  );
}
