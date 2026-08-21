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
      <section className="bg-balsa-primary text-balsa-primary-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-balsa-primary/20 px-3 py-1 text-balsa-xs font-balsa-body text-balsa-primary-foreground/70">
              {t("hero.eyebrow")}
            </span>
            <h1 className="text-balsa-4xl font-balsa-title leading-[1.1] sm:text-balsa-5xl lg:text-balsa-6xl">
              {t("hero.title")}
            </h1>
            <p className="max-w-lg text-balsa-lg font-balsa-body text-balsa-primary-foreground/85">
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
                className="border-balsa-primary/20 text-balsa-primary-foreground hover:bg-balsa-primary/10"
              >
                <Link href="#modules">{t("hero.secondary")}</Link>
              </Button>
            </div>
          </div>

          {/* Product mock — real tokens, no stock */}
          <div
            aria-hidden="true"
            className="relative rounded-balsa-panel border border-balsa-primary/20 bg-balsa-surface p-4 shadow-balsa-lg"
          >
            <div className="rounded-balsa-surface border border-balsa-border bg-balsa-surface-elevated p-4">
              <p className="text-balsa-xs font-balsa-body font-semibold uppercase tracking-balsa-label text-balsa-muted-foreground">
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
                    className="flex items-center gap-2.5 rounded-balsa-control border border-balsa-border bg-balsa-background px-3 py-2"
                  >
                    {i === 0 ? (
                      <Check size={14} className="text-balsa-success" aria-hidden />
                    ) : (
                      <Circle size={14} className="text-balsa-muted-foreground" aria-hidden />
                    )}
                    <span className="text-balsa-sm font-balsa-body text-balsa-muted-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 border-t border-balsa-border pt-3">
                {[t("mock.metric1"), t("mock.metric2"), t("mock.metric3")].map(
                  (label) => (
                    <div key={label} className="rounded-balsa-control bg-balsa-muted px-2 py-2">
                      <p className="text-balsa-xs font-balsa-body text-balsa-primary">{label}</p>
                      <p className="text-balsa-sm font-balsa-body font-semibold text-balsa-foreground">
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
          <h2 className="text-balsa-3xl font-balsa-title text-balsa-foreground sm:text-balsa-4xl">
            {t("modulesTitle")}
          </h2>
          <p className="text-balsa-lg font-balsa-body text-balsa-muted-foreground">{t("modulesSubtitle")}</p>
        </div>
        <ul className="mt-10 grid gap-x-10 gap-y-8 border-t border-balsa-border pt-8 sm:grid-cols-2">
          {modules.map(({ id, icon: Icon, name, description }) => (
            <li key={id} className="flex items-start gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-balsa-surface bg-balsa-primary/10 text-balsa-primary">
                <Icon size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-balsa-lg font-balsa-title text-balsa-foreground">{name}</h3>
                <p className="mt-1 text-balsa-sm font-balsa-body text-balsa-muted-foreground">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-balsa-border bg-balsa-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-balsa-3xl font-balsa-title text-balsa-foreground sm:text-balsa-4xl">
              {t("howTitle")}
            </h2>
            <p className="text-balsa-lg font-balsa-body text-balsa-muted-foreground">{t("howSubtitle")}</p>
          </div>
          <ol className="mt-10 grid gap-6 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="rounded-balsa-panel border border-balsa-border bg-balsa-surface p-6 shadow-balsa-md"
              >
                <span className="text-balsa-4xl font-balsa-title text-balsa-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 text-balsa-xl font-balsa-title text-balsa-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-balsa-sm font-balsa-body text-balsa-muted-foreground">
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
            <h2 className="text-balsa-3xl font-balsa-title text-balsa-foreground sm:text-balsa-4xl">
              {t("pricingTitle")}
            </h2>
            <p className="max-w-md text-balsa-lg font-balsa-body text-balsa-muted-foreground">
              {t("pricingSubtitle")}
            </p>
            <ul className="space-y-2.5">
              {[t("pricing.point1"), t("pricing.point2"), t("pricing.point3")].map(
                (point) => (
                  <li key={point} className="flex items-center gap-2.5">
                    <Check size={16} className="text-balsa-success" aria-hidden="true" />
                    <span className="text-balsa-sm font-balsa-body text-balsa-muted-foreground">
                      {point}
                    </span>
                  </li>
                )
              )}
            </ul>
          </div>
          <div className="rounded-balsa-panel border border-balsa-border bg-balsa-surface p-6 shadow-balsa-md sm:p-8">
            <div className="flex items-center gap-2 text-balsa-sm font-balsa-body font-medium text-balsa-muted-foreground">
              <Lock size={14} aria-hidden="true" />
              {t("pricing.cardTitle")}
            </div>
            <p className="mt-4 text-balsa-base font-balsa-body text-balsa-muted-foreground">
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
