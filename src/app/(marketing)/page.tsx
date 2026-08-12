"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  SunMedium,
  FolderKanban,
  Calendar,
  FileText,
  Wallet,
  Check,
  ArrowRight,
  Circle,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const MODULE_ICONS = {
  tasks: SunMedium,
  projects: FolderKanban,
  calendar: Calendar,
  documents: FileText,
  financial: Wallet,
} as const;

export default function LandingPage() {
  const t = useTranslations("landing");

  const modules = (
    ["tasks", "projects", "calendar", "documents", "financial"] as const
  ).map((id) => ({
    id,
    icon: MODULE_ICONS[id],
    name: t(`modules.${id}.name`),
    description: t(`modules.${id}.description`),
  }));

  const steps = [1, 2, 3].map((n) => ({
    title: t(`steps.${n}.title`),
    description: t(`steps.${n}.description`),
  }));

  return (
    <main>
      {/* Hero */}
      <section className="bg-sidebar text-sidebar-text">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-sidebar-divider px-3 py-1 text-caption text-sidebar-text/70">
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.75rem]">
              {t("hero.title")}
            </h1>
            <p className="max-w-lg text-body text-sidebar-text/85">
              {t("hero.subtitle")}
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/login?mode=register">
                  {t("hero.cta")}
                  <ArrowRight size={16} className="ml-1" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-sidebar-divider text-sidebar-text hover:bg-sidebar-hover"
              >
                <Link href="#modules">{t("hero.secondary")}</Link>
              </Button>
            </div>
          </div>

          {/* Product mock — real tokens, no stock */}
          <div
            aria-hidden="true"
            className="relative rounded-xl border border-sidebar-divider bg-page p-4 shadow-elevated"
          >
            <div className="rounded-lg border border-border bg-white p-4">
              <p className="text-label uppercase tracking-[0.12em] text-text-muted">
                {t("mock.cockpit")}
              </p>
              <div className="mt-3 space-y-2">
                {[
                  t("mock.task1"),
                  t("mock.task2"),
                  t("mock.task3"),
                ].map((label, i) => (
                  <div
                    key={label}
                    className="flex items-center gap-2.5 rounded-md border border-border bg-page-alt px-3 py-2"
                  >
                    {i === 0 ? (
                      <Check size={14} className="text-success" aria-hidden />
                    ) : (
                      <Circle size={14} className="text-text-muted" aria-hidden />
                    )}
                    <span className="text-body-small text-text-secondary">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                {[t("mock.metric1"), t("mock.metric2"), t("mock.metric3")].map(
                  (label) => (
                    <div key={label} className="rounded-md bg-brand-50 px-2 py-2">
                      <p className="text-micro text-brand-700">{label}</p>
                      <p className="text-body-small font-semibold text-text-primary">
                        —
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl space-y-3">
          <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
            {t("modulesTitle")}
          </h2>
          <p className="text-body text-text-secondary">{t("modulesSubtitle")}</p>
        </div>
        <ul className="mt-10 grid gap-x-10 gap-y-8 border-t border-border pt-8 sm:grid-cols-2">
          {modules.map(({ id, icon: Icon, name, description }) => (
            <li key={id} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-heading-2 text-text-primary">{name}</h3>
                <p className="mt-1 text-body-small text-text-secondary">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-border bg-page-alt">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {t("howTitle")}
            </h2>
            <p className="text-body text-text-secondary">{t("howSubtitle")}</p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-xl border border-border bg-white p-6 shadow-card"
              >
                <span className="text-display text-brand-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-heading-1 text-text-primary">
                  {step.title}
                </h3>
                <p className="mt-2 text-body-small text-text-secondary">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Paywall CTA */}
      <section id="pricing" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
              {t("pricingTitle")}
            </h2>
            <p className="max-w-md text-body text-text-secondary">
              {t("pricingSubtitle")}
            </p>
            <ul className="space-y-2.5">
              {[t("pricing.point1"), t("pricing.point2"), t("pricing.point3")].map(
                (point) => (
                  <li key={point} className="flex items-center gap-2.5">
                    <Check size={16} className="text-success" aria-hidden="true" />
                    <span className="text-body-small text-text-secondary">
                      {point}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-white p-6 shadow-card sm:p-8">
            <div className="flex items-center gap-2 text-body-small font-medium text-text-secondary">
              <Lock size={14} aria-hidden="true" />
              {t("pricing.cardTitle")}
            </div>
            <p className="mt-4 text-body text-text-secondary">
              {t("pricing.cardBody")}
            </p>
            <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
              <Link href="/login?mode=register">
                {t("pricing.cardCta")}
                <ArrowRight size={16} className="ml-1" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
