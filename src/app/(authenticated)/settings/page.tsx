"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, MapPin, ShieldCheck, UserRound, Users } from "lucide-react";
import { useCan } from "@/hooks/use-permissions";
import { SettingsHeader, SettingsShell } from "@/components/settings/settings-shell";

export default function SettingsPage() {
  const t = useTranslations("settings.page");
  const { can } = useCan();

  const cards = [
    { key: "profile", permission: true, title: t("profile.title"), description: t("profile.description"), href: "/settings/profile", icon: UserRound },
    { key: "areas", permission: can("areas.view"), title: t("areas.title"), description: t("areas.description"), href: "/settings/areas", icon: MapPin },
    { key: "team", permission: can("manage_roles"), title: t("team.title"), description: t("team.description"), href: "/settings/team", icon: Users },
    { key: "workspace", permission: can("manage_roles"), title: t("workspace.title"), description: t("workspace.description"), href: "/settings/workspace", icon: Building2 },
    { key: "roles", permission: can("manage_roles"), title: t("roles.title"), description: t("roles.description"), href: "/settings/roles", icon: ShieldCheck },
  ].filter((card) => card.permission);

  return (
    <SettingsShell testId="settings-page">
      <SettingsHeader title={t("title")} description={t("subtitle")} />

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <SettingsCard
            key={card.key}
            title={card.title}
            description={card.description}
            href={card.href}
            icon={card.icon}
          />
        ))}
      </div>
    </SettingsShell>
  );
}

function SettingsCard({
  title,
  description,
  href,
  icon: Icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: typeof UserRound;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-page-alt p-5 shadow-card transition-[transform,box-shadow,border-color] hover:border-accent hover:shadow-elevated motion-safe:hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-colors group-hover:bg-accent group-hover:text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="text-base font-semibold text-text-primary">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>
    </Link>
  );
}
