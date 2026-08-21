"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Info } from "lucide-react";

export function CheckinReminderBanner() {
  const t = useTranslations("checkin");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      data-testid="checkin-reminder-banner"
      role="status"
      className="flex flex-wrap items-center justify-center gap-3 bg-info-bg px-4 py-2 text-center text-sm text-info"
    >
      <Info className="h-4 w-4 shrink-0" />
      <span>{t("reminderBody")}</span>
      <Link
        href="/beta/checkin"
        className="inline-flex items-center rounded-md border border-info bg-transparent px-3 py-1 text-sm font-medium text-info hover:bg-info-bg"
      >
        {t("reminderAction")}
      </Link>
      <button
        type="button"
        className="ml-2 text-xs underline hover:text-info/80"
        onClick={() => setDismissed(true)}
      >
        {t("reminderDismiss")}
      </button>
    </div>
  );
}
