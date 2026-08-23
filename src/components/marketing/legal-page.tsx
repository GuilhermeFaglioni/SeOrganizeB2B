"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type LegalDocument = "privacy" | "terms" | "contact";

const SECTION_KEYS: Record<LegalDocument, readonly string[]> = {
  privacy: [
    "controller",
    "googleData",
    "calendarUse",
    "storage",
    "sharing",
    "retention",
    "aiStudioProviders",
    "aiStudioProcessing",
    "aiStudioRetention",
    "aiStudioTelemetry",
    "aiStudioCosts",
    "rights",
    "internationalTransfers",
    "limitedUse",
    "changes",
  ],
  terms: [
    "service",
    "access",
    "acceptableUse",
    "integrations",
    "aiStudioUse",
    "aiStudioProviderAuth",
    "aiStudioCosts",
    "billing",
    "content",
    "availability",
    "termination",
    "changes",
  ],
  contact: ["support", "privacy", "legal"],
};

export function LegalPage({ document }: { document: LegalDocument }) {
  const common = useTranslations("legal");
  const t = useTranslations(`legal.${document}`);

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-page px-4 py-12 sm:px-6 sm:py-16">
      <article className="mx-auto max-w-3xl">
        <p className="text-label uppercase tracking-[0.18em] text-accent">
          {t("eyebrow")}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mt-3 text-sm text-text-muted">{t("updated")}</p>
        <p className="mt-8 text-base leading-7 text-text-secondary">{t("intro")}</p>

        <div className="mt-10 space-y-8">
          {SECTION_KEYS[document].map((section) => (
            <section key={section}>
              <h2 className="text-lg font-semibold text-text-primary">
                {t(`sections.${section}.title`)}
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-7 text-text-secondary">
                {t(`sections.${section}.body`)}
              </p>
            </section>
          ))}
        </div>

        <nav
          aria-label={common("relatedPages")}
          className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-sm text-accent"
        >
          <Link href="/privacy" className="hover:underline">
            {common("privacyLink")}
          </Link>
          <Link href="/terms" className="hover:underline">
            {common("termsLink")}
          </Link>
          <Link href="/contact" className="hover:underline">
            {common("contactLink")}
          </Link>
        </nav>
      </article>
    </main>
  );
}
