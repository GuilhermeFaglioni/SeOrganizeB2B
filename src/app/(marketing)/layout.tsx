"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";

function BrandMark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white shadow-card">
        S+
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-text-primary">
        {APP_NAME}
      </span>
    </span>
  );
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("landing");
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
    });
  }, []);

  return (
    <div className="min-h-[100dvh] bg-page text-text-primary">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-page/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label={APP_NAME}>
            <BrandMark />
          </Link>
          <nav
            className="hidden items-center gap-8 text-body-small font-medium text-text-secondary md:flex"
            aria-label={t("nav.aria")}
          >
            <a href="#modules" className="transition-colors hover:text-text-primary">
              {t("nav.modules")}
            </a>
            <a href="#how" className="transition-colors hover:text-text-primary">
              {t("nav.how")}
            </a>
            <a href="#pricing" className="transition-colors hover:text-text-primary">
              {t("nav.pricing")}
            </a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Button asChild variant="ghost" size="sm">
              <Link href={authed ? "/app" : "/login"}>
                {authed ? t("nav.openApp") : t("nav.signIn")}
              </Link>
            </Button>
            {!authed && (
              <Button asChild size="sm">
                <Link href="/login?mode=register">{t("nav.cta")}</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {children}

      <footer className="border-t border-border bg-page-alt">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-10 text-center sm:px-6">
          <BrandMark />
          <p className="text-body-small text-text-muted">{t("footer.tagline")}</p>
          <div className="flex items-center gap-4 text-body-small text-text-secondary">
            <Link href="/login" className="transition-colors hover:text-text-primary">
              {t("nav.signIn")}
            </Link>
            <Link
              href="/login?mode=register"
              className="transition-colors hover:text-text-primary"
            >
              {t("nav.cta")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
