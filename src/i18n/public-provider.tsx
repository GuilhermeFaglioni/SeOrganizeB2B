"use client";

import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import ptBR from "../../messages/pt-BR.json";
import en from "../../messages/en.json";
import type { AppLocale } from "./config";

const messages: Record<AppLocale, typeof ptBR> = {
  "pt-BR": ptBR,
  en,
};

export function PublicLocaleProvider({
  locale,
  children,
}: {
  locale: AppLocale;
  children: ReactNode;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      {children}
    </NextIntlClientProvider>
  );
}
