"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-permissions";

export default function SettingsPage() {
  const t = useTranslations("settings.page");
  const { can } = useCan();

  const cards = [
    { key: "profile", permission: true, title: t("profile.title"), description: t("profile.description"), href: "/settings/profile" },
    { key: "areas", permission: can("areas.view"), title: t("areas.title"), description: t("areas.description"), href: "/settings/areas" },
    { key: "team", permission: can("manage_roles"), title: t("team.title"), description: t("team.description"), href: "/settings/team" },
    { key: "workspace", permission: can("manage_roles"), title: t("workspace.title"), description: t("workspace.description"), href: "/settings/workspace" },
    { key: "roles", permission: can("manage_roles"), title: t("roles.title"), description: t("roles.description"), href: "/settings/roles" },
  ].filter((card) => card.permission);

  return (
    <div data-testid="settings-page" className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-heading-1 text-text-primary">{t("title")}</h1>
        <p className="text-body-small text-text-secondary mt-1">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-4">
        {cards.map((card) => (
          <SettingsCard
            key={card.key}
            title={card.title}
            description={card.description}
            href={card.href}
          />
        ))}
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
