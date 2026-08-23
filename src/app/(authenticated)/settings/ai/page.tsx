"use client";

import { useTranslations } from "next-intl";
import { useCan } from "@/hooks/use-permissions";
import { AiConnections } from "@/components/settings/ai-connections";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

export default function AiSettingsPage() {
  const t = useTranslations("settings.ai");
  const { can, data } = useCan();

  if (data && !can("ai.manageConnections")) {
    return (
      <SettingsShell testId="ai-settings-page">
        <SettingsBackLink label={t("backToSettings")} />
        <SettingsHeader title={t("title")} description={t("subtitle")} />
        <SettingsSection>
          <p className="text-sm text-text-secondary">{t("noPermission")}</p>
        </SettingsSection>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell testId="ai-settings-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader title={t("title")} description={t("subtitle")} />
      <AiConnections />
    </SettingsShell>
  );
}
