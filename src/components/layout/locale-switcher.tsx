"use client";

import { Languages } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { localeNativeNames, locales } from "@/i18n/config";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function LocaleSwitcher() {
  const { locale, setLocale } = useI18n();
  const t = useTranslations("layout.localeSwitcher");

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-balsa-control border border-balsa-border bg-balsa-background px-1 py-0.5"
      role="group"
      aria-label={t("label")}
      title={t("title")}
    >
      <Languages
        size={14}
        className="ml-1 text-balsa-muted-foreground"
        aria-hidden="true"
      />
      {locales.map((code) => (
        <Button
          key={code}
          type="button"
          variant={locale === code ? "solid" : "text"}
          color={locale === code ? "primary" : "neutral"}
          size="sm"
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          aria-label={code}
          className={cn(
            "min-w-8 rounded-balsa-control px-1.5 text-xs font-semibold",
            locale === code
              ? "text-balsa-primary-foreground"
              : "text-balsa-muted-foreground hover:bg-balsa-muted hover:text-balsa-foreground"
          )}
        >
          {localeNativeNames[code]}
        </Button>
      ))}
    </div>
  );
}
