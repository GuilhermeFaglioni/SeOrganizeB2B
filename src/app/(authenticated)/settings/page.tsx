"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("settings.page");
  return (
    <div data-testid="settings-page" className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-heading-1 text-text-primary">{t("title")}</h1>
        <p className="text-body-small text-text-secondary mt-1">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-4">
        <SettingsCard
          title={t("profile.title")}
          description={t("profile.description")}
          href="/settings/profile"
        />
        <SettingsCard
          title={t("areas.title")}
          description={t("areas.description")}
          href="/settings/areas"
        />
        <SettingsCard
          title={t("team.title")}
          description={t("team.description")}
          href="/settings/team"
        />
        <SettingsCard
          title={t("workspace.title")}
          description={t("workspace.description")}
          href="/settings/workspace"
        />
      </div>
    </div>
  );
}

function SettingsCard({ title, description, href }: { title: string; description: string; href: string }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(href)}
      className="cursor-pointer rounded-xl border border-border bg-page-alt p-5 shadow-card transition-[transform,box-shadow,border-color] hover:border-accent hover:shadow-elevated motion-safe:hover:-translate-y-0.5"
    >
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="text-sm text-text-secondary mt-1">{description}</p>
    </div>
  );
}
