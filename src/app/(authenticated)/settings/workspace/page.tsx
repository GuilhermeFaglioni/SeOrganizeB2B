"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useUpdateWorkspaceSettings,
  useWorkspaceSettings,
} from "@/hooks/use-proposals";
import { toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";

export default function WorkspaceSettingsPage() {
  const t = useTranslations("settings.workspace");
  const { data } = useWorkspaceSettings();
  const update = useUpdateWorkspaceSettings();
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      hydrated.current = true;
      setCompanyName(data.companyName ?? "");
      setLogoUrl(data.logoUrl ?? "");
    }
  }, [data]);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    update.mutate(
      { companyName, logoUrl },
      { onSuccess: () => toastSuccess(t("saved")) }
    );
  }

  if (!data) return <LoadingState />;

  return (
    <SettingsShell testId="workspace-settings-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader title={t("title")} description={t("subtitle")} />

      <SettingsSection>
        <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="company-name">{t("companyNameLabel")}</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder={t("companyNamePlaceholder")}
          />
          <p className="text-xs text-text-muted">{t("companyNameHint")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="logo-url">{t("logoUrlLabel")}</Label>
          <Input
            id="logo-url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-text-muted">{t("logoUrlHint")}</p>
        </div>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t("saving") : t("save")}
        </Button>
        </form>
      </SettingsSection>
    </SettingsShell>
  );
}
