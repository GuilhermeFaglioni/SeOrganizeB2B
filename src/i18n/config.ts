export const LOCALE_COOKIE = "NEXT_LOCALE";

export const locales = ["pt-BR", "en"] as const;
export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "pt-BR";

export const localeLabels: Record<AppLocale, string> = {
  "pt-BR": "Português (BR)",
  en: "English (US)",
};

export const localeNativeNames: Record<AppLocale, string> = {
  "pt-BR": "PT",
  en: "EN",
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value != null && (locales as readonly string[]).includes(value);
}
