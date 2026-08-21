"use client";

import { TodayTasks } from "@/components/today/today-tasks";
import { TodayAgenda } from "@/components/today/today-agenda";
import { TodayActivity } from "@/components/today/today-activity";
import { TodayBusiness } from "@/components/today/today-business";
import { useNotifications } from "@/hooks/use-notifications";
import { TodaySavedViews } from "@/components/today/today-saved-views";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

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
            <p className="text-balsa-2xs uppercase tracking-balsa-label text-balsa-muted-foreground">
              {t("executiveCockpit")}
            </p>
            <h2 className="font-balsa-title text-balsa-3xl capitalize text-balsa-foreground">{today}</h2>
          </div>
          <Badge
            variant="glass"
            color="secondary"
            size="md"
            className="shrink-0"
            aria-live="polite"
          >
            {t("unreadNotifications", { count: notifications?.unreadCount ?? 0 })}
          </Badge>
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
