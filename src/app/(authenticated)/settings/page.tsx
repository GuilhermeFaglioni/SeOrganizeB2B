"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bot, Building2, MapPin, ShieldCheck, Sparkles, UserRound, Users } from "lucide-react";
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
    { key: "aiConnections", permission: can("ai.manageConnections"), title: t("aiConnections.title"), description: t("aiConnections.description"), href: "/settings/ai", icon: Sparkles },
    { key: "aiDirective", permission: can("ai.manageDirectives"), title: t("aiDirective.title"), description: t("aiDirective.description"), href: "/settings/ai-directive", icon: Bot },
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
      data-balsa="link"
      className="balsa-surface group rounded-balsa-surface p-5 transition-[transform,box-shadow,border-color] hover:border-balsa-primary hover:shadow-balsa-panel motion-safe:hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-balsa-focus-ring"
    >
      <span className="mb-5 flex h-10 w-10 items-center justify-center rounded-balsa-control bg-balsa-primary/10 text-balsa-primary transition-colors group-hover:bg-balsa-primary group-hover:text-balsa-primary-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h2 className="font-balsa-title text-base font-semibold text-balsa-foreground">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-balsa-muted-foreground">{description}</p>
    </Link>
  );
}
