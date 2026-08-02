"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { localeNativeNames, locales } from "@/i18n/config";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useTranslations("layout.localeSwitcher");

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-page px-1 py-0.5"
      role="group"
      aria-label={t("label")}
      title={t("title")}
    >
      <Languages
        size={14}
        className="ml-1 text-text-muted"
        aria-hidden="true"
      />
      {locales.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          aria-label={code}
          className={cn(
            "min-h-[30px] min-w-[32px] rounded px-1.5 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
            locale === code
              ? "bg-accent text-white"
              : "text-text-secondary hover:bg-page hover:text-text-primary"
          )}
        >
          {localeNativeNames[code]}
        </button>
      ))}
    </div>
  );
}
