"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { NextIntlClientProvider } from "next-intl";
import ptBR from "../../messages/pt-BR.json";
import en from "../../messages/en.json";
import {
  type AppLocale,
  defaultLocale,
  isAppLocale,
  LOCALE_COOKIE,
} from "./config";

const messages: Record<AppLocale, typeof ptBR> = {
  "pt-BR": ptBR,
  en,
};

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
}

const I18nContext = createContext<I18nContextValue>({
  locale: defaultLocale,
  setLocale: () => {},
});

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(() => {
    const stored = readCookie(LOCALE_COOKIE);
    return isAppLocale(stored) ? stored : defaultLocale;
  });
  const userChoseRef = useRef(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((response) => response.json())
      .then((payload: { data?: { locale?: string } | null }) => {
        if (userChoseRef.current) return;
        if (isAppLocale(payload.data?.locale)) {
          setLocaleState(payload.data.locale as AppLocale);
        }
      })
      .catch(() => {
        // Unauthenticated or network error; keep the cookie/default locale.
      });
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: AppLocale) => {
    userChoseRef.current = true;
    setLocaleState(next);
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;
    fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {
      // Best-effort persistence; the cookie keeps the choice locally.
    });
  }, []);

  const value = useMemo(
    () => ({ locale, setLocale }),
    [locale, setLocale]
  );

  return (
    <I18nContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]}>
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
