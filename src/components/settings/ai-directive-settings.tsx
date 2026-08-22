"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useAiDirective, useClearAiDirective, useSaveAiDirective } from "@/hooks/use-ai-directive";
import { AI_DIRECTIVE_MAX_LENGTH } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import {
  SettingsBackLink,
  SettingsHeader,
  SettingsSection,
  SettingsShell,
} from "@/components/settings/settings-shell";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function AiDirectiveSettings() {
  const t = useTranslations("settings.aiDirective");
  const { data, isLoading, isError, refetch } = useAiDirective();
  const saveDirective = useSaveAiDirective();
  const clearDirective = useClearAiDirective();
  const [draft, setDraft] = useState("");
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (data && !hydrated) {
      setHydrated(true);
      setDraft(data.content);
    }
  }, [data, hydrated]);

  const remaining = useMemo(
    () => AI_DIRECTIVE_MAX_LENGTH - draft.length,
    [draft]
  );
  const overLimit = remaining < 0;
  const dirty = data ? data.content !== draft.trim() : draft.trim().length > 0;
  const saving = saveDirective.isPending || clearDirective.isPending;

  if (isLoading) return <LoadingState />;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (overLimit) return;
    saveDirective.mutate(draft.trim());
  }

  return (
    <SettingsShell testId="ai-directive-settings-page">
      <SettingsBackLink label={t("backToSettings")} />
      <SettingsHeader
        title={t("title")}
        description={t("subtitle")}
      />

      {isError && (
        <div
          role="alert"
          className="rounded-xl border border-danger bg-danger-bg p-4 text-sm text-danger"
        >
          <p>{t("loadFailed")}</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 rounded-md px-3 py-1.5 text-xs font-medium underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            {t("retry")}
          </button>
        </div>
      )}

      <SettingsSection title={t("sectionTitle")} description={t("sectionDescription")}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai-directive-content">{t("contentLabel")}</Label>
            <textarea
              id="ai-directive-content"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={10}
              aria-describedby="ai-directive-hint"
              className="w-full rounded-md border border-border bg-page px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            />
            <p
              id="ai-directive-hint"
              className={overLimit ? "text-sm font-medium text-danger" : "text-xs text-text-muted"}
              data-testid="ai-directive-counter"
            >
              {t("counter", { current: draft.length, max: AI_DIRECTIVE_MAX_LENGTH })}
            </p>
            {overLimit && (
              <p role="alert" className="text-sm font-medium text-danger">
                {t("tooLong")}
              </p>
            )}
          </div>

          {data && (
            <p className="text-xs text-text-muted">
              {t("lastUpdated", {
                updatedAt: new Date(data.updatedAt).toLocaleString(),
              })}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={saving || !dirty || overLimit}>
              {saving ? t("saving") : t("save")}
            </Button>
            {data && (
              <Button
                type="button"
                variant="destructive"
                disabled={saving}
                onClick={() => setConfirmClearOpen(true)}
              >
                {t("clear")}
              </Button>
            )}
          </div>
        </form>
      </SettingsSection>

      {data && (
        <SettingsSection title={t("usageTitle")} description={t("usageDescription")}>
          <p className="text-sm text-text-secondary">{t("usageBody")}</p>
        </SettingsSection>
      )}

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent data-testid="ai-directive-clear-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmClearTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmClearDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" onClick={() => setConfirmClearOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={clearDirective.isPending}
              onClick={() => {
                setConfirmClearOpen(false);
                setDraft("");
                clearDirective.mutate();
              }}
            >
              {clearDirective.isPending ? t("clearing") : t("confirmClear")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsShell>
  );
}
