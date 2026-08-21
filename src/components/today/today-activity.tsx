"use client";

import { useTranslations } from "next-intl";
import { ActivityFeed } from "@/components/activity/activity-feed";

export function TodayActivity() {
  const t = useTranslations("today.activity");
  return (
    <section className="balsa-surface rounded-balsa-panel p-5">
      <h3 className="mb-4 font-balsa-title text-lg font-semibold text-balsa-foreground">
        {t("heading")}
      </h3>
      <ActivityFeed limit={12} />
    </section>
  );
}
