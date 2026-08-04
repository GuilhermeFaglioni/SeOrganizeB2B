"use client";

import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-permissions";
import { RolesManager } from "@/components/settings/roles-manager";
import {
  SettingsBackLink,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

export default function RolesPage() {
  const t = useTranslations("roles.page");
  const { can, data } = useCan();

  if (data && !can("manage_roles")) {
    return (
      <SettingsShell testId="roles-page">
        <SettingsBackLink label={t("backToSettings")} />
        <SettingsSection>
          <p className="text-sm text-text-secondary">{t("noPermission")}</p>
        </SettingsSection>
      </SettingsShell>
    );
  }

  return <RolesManager />;
}
