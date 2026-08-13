"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Building2,
  Users,
  FileText,
  CheckSquare2,
  X,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useOnboarding,
  type OnboardingStep,
} from "@/hooks/use-onboarding";

const STEP_ICONS: Record<OnboardingStep, typeof Building2> = {
  company: Building2,
  client: Users,
  proposal: FileText,
  task: CheckSquare2,
};

export function OnboardingWizard() {
  const t = useTranslations("onboarding.wizard");
  const { showWizard, currentStep, steps, skip, progress } =
    useOnboarding();

  if (!showWizard) return null;

  return (
    <section
      data-testid="onboarding-wizard"
      className="rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-page-alt p-5 shadow-card"
      aria-label={t("ariaLabel")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent" />
          <h2 className="text-heading-1 text-text-primary">{t("title")}</h2>
        </div>
        <button
          onClick={skip}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-text-muted hover:text-text-secondary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t("dismiss")}
        >
          <X size={18} />
        </button>
      </div>

      <p className="mt-1 text-sm text-text-secondary">{t("subtitle")}</p>

      {/* Progress bar */}
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${progress}%` }}
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("progressAria", { percent: progress })}
        />
      </div>

      {/* Steps */}
      <ol className="mt-4 space-y-2">
        {steps.map((step) => {
          const Icon = STEP_ICONS[step.id];
          const isCurrent = step.id === currentStep;
          const isDone = step.done;
          const stepKey = step.id as OnboardingStep;

          return (
            <li key={step.id}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  isCurrent
                    ? "border-accent/40 bg-accent/5"
                    : isDone
                      ? "border-border bg-page-alt opacity-70"
                      : "border-transparent bg-transparent"
                )}
              >
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isDone
                      ? "bg-success text-white"
                      : isCurrent
                        ? "bg-accent text-white"
                        : "bg-border text-text-muted"
                  )}
                >
                  {isDone ? (
                    <CheckSquare2 size={16} />
                  ) : (
                    <Icon size={16} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isDone
                        ? "text-text-muted line-through"
                        : isCurrent
                          ? "text-text-primary"
                          : "text-text-secondary"
                    )}
                  >
                    {t(`steps.${stepKey}.title`)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {t(`steps.${stepKey}.description`)}
                  </p>
                </div>
                {isCurrent && (
                  <Button asChild size="sm">
                    <Link href={step.href}>
                      {t(`steps.${stepKey}.action`)}
                      <ArrowRight size={14} />
                    </Link>
                  </Button>
                )}
                {isDone && (
                  <span className="text-xs font-medium text-success">
                    {t("done")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="mt-3 text-xs text-text-muted">{t("skipHint")}</p>
    </section>
  );
}
