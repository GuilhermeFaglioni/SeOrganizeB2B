import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsShellProps = {
  children: ReactNode;
  className?: string;
  testId?: string;
};

export function SettingsShell({ children, className, testId }: SettingsShellProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "h-full min-h-0 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-5xl space-y-8">{children}</div>
    </div>
  );
}

type SettingsHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SettingsHeader({ title, description, action }: SettingsHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="max-w-2xl text-sm text-text-secondary sm:text-base">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

type SettingsSectionProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
};

export function SettingsSection({
  children,
  title,
  description,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("rounded-xl border border-border bg-page-alt p-5 shadow-card sm:p-6", className)}>
      {title || description ? (
        <div className="mb-5 space-y-1">
          {title ? <h2 className="text-lg font-semibold text-text-primary">{title}</h2> : null}
          {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type SettingsBackLinkProps = {
  href?: string;
  label: string;
};

export function SettingsBackLink({ href = "/settings", label }: SettingsBackLinkProps) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}
