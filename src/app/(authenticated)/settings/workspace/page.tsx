"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  useUpdateWorkspace,
  useWorkspace,
} from "@/hooks/use-proposals";
import { toastSuccess, toastError } from "@/lib/toast";
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

export default function WorkspacePage() {
  const t = useTranslations("settings.workspace");
  const { data } = useWorkspace();
  const update = useUpdateWorkspace();
  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [bindingCode, setBindingCode] = useState("");
  const [bindingCodeConfirm, setBindingCodeConfirm] = useState("");
  const hydrated = useRef(false);

  useEffect(() => {
    if (data && !hydrated.current) {
      hydrated.current = true;
      setCompanyName(data.companyName ?? "");
      setLogoUrl(data.logoUrl ?? "");
      setPixKey(data.pixKey ?? "");
    }
  }, [data]);

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (bindingCode || bindingCodeConfirm) {
      if (bindingCode !== bindingCodeConfirm) {
        toastError(t("bindingCodeMismatch"));
        return;
      }
    }

    update.mutate(
      {
        companyName,
        logoUrl,
        pixKey,
        ...(bindingCode ? { bindingCode } : {}),
      },
      {
        onSuccess: () => {
          setBindingCode("");
          setBindingCodeConfirm("");
          toastSuccess(t("saved"));
        },
        onError: () => toastError(t("saveFailed")),
      }
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
        <div className="space-y-2">
          <Label htmlFor="pix-key">{t("pixKeyLabel")}</Label>
          <Input
            id="pix-key"
            value={pixKey}
            onChange={(event) => setPixKey(event.target.value)}
            placeholder={t("pixKeyPlaceholder")}
          />
          <p className="text-xs text-text-muted">{t("pixKeyHint")}</p>
        </div>
        <div className="space-y-2 border-t border-border pt-4">
          <Label htmlFor="binding-code">{t("bindingCodeLabel")}</Label>
          <Input
            id="binding-code"
            type="password"
            autoComplete="new-password"
            value={bindingCode}
                onChange={(event) => setBindingCode(event.target.value)}
                placeholder={t("bindingCodePlaceholder")}
                minLength={8}
          />
          <p className="text-xs text-text-muted">
            {data.hasBindingCode
              ? t("bindingCodeConfiguredHint")
              : t("bindingCodeHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="binding-code-confirm">
            {t("bindingCodeConfirmLabel")}
          </Label>
          <Input
            id="binding-code-confirm"
            type="password"
            autoComplete="new-password"
            value={bindingCodeConfirm}
            onChange={(event) => setBindingCodeConfirm(event.target.value)}
            placeholder={t("bindingCodeConfirmPlaceholder")}
          />
          <p className="text-xs text-text-muted">{t("bindingCodeShareHint")}</p>
        </div>
        <Button type="submit" disabled={update.isPending}>
          {update.isPending ? t("saving") : t("save")}
        </Button>
        </form>
      </SettingsSection>
    </SettingsShell>
  );
}
