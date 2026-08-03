"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export default function WorkspaceSettingsPage() {
  const router = useRouter();
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
    <div data-testid="workspace-settings-page" className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/settings")}
          className="text-sm text-text-secondary hover:text-text-primary"
        >
          &larr; {t("backToSettings")}
        </button>
      </div>

      <div>
        <h1 className="text-heading-1 text-text-primary">{t("title")}</h1>
        <p className="text-body-small text-text-secondary mt-1">
          {t("subtitle")}
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-border bg-page-alt p-5">
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
    </div>
  );
}
