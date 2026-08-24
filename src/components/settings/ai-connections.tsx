"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  useAIProviders,
  useAiConnections,
  useConnectAiProvider,
  useRevokeAiConnection,
  useValidateAiConnection,
} from "@/hooks/use-ai-connections";
import { toastError, toastSuccess } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingState } from "@/components/shared/loading-state";
import { SettingsSection } from "@/components/settings/settings-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PROVIDER_LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  opencode: "OpenCode Zen",
  "opencode-go": "OpenCode Go",
};

export function AiConnections() {
  const t = useTranslations("settings.ai");
  const { data: providers, isError: providersError, refetch: refetchProviders } = useAIProviders();
  const { data: connections, isLoading, isError: connectionsError, refetch: refetchConnections } = useAiConnections();
  const connect = useConnectAiProvider();
  const validate = useValidateAiConnection();
  const revoke = useRevokeAiConnection();

  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");

  if (providersError || connectionsError) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-text-secondary">{t("loadFailed")}</p>
        <Button
          variant="outline"
          onClick={() => {
            refetchProviders();
            refetchConnections();
          }}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (isLoading || !connections || !providers) return <LoadingState />;

  const selectedProvider = providers.find((p) => p.id === provider);
  const effectiveModel = model || selectedProvider?.defaultModel || "";
  const existing = connections.find((c) => c.provider === provider);
  const oauthAvailable = Boolean(selectedProvider && selectedProvider.authMethods.includes("oauth"));
  const oauthReasonKey = selectedProvider?.oauth?.reasonKey as string | undefined;

  const handleAuthMethodsLabels = (methods: string[]): string =>
    methods
      .map((method) => (method === "api_key" ? t("apiKeyMethodLabel") : t("oauthMethodLabel")))
      .join(" · ");

  const handleProviderChange = (value: string) => {
    setProvider(value);
    const connection = connections.find((c) => c.provider === value);
    const next = providers.find((p) => p.id === value);
    setModel(connection?.defaultModel ?? next?.defaultModel ?? "");
  };

  function handleConnect(event: React.FormEvent) {
    event.preventDefault();
    connect.mutate(
      { provider, apiKey, defaultModel: effectiveModel },
      {
        onSuccess: () => {
          setApiKey("");
          toastSuccess(existing ? t("replacedSuccess") : t("connectedSuccess"));
        },
        onError: (error) => toastError(error.message),
      },
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSection
        title={t("sectionTitle")}
        description={t("sectionDescription")}
      >
        <form onSubmit={handleConnect} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("providerLabel")}</Label>
              <Select value={provider} onValueChange={handleProviderChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("modelLabel")}</Label>
              <Select value={effectiveModel} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {selectedProvider?.models.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-api-key">{t("apiKeyLabel")}</Label>
            <Input
              id="ai-api-key"
              type="password"
              autoComplete="new-password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={t("apiKeyPlaceholder")}
            />
            <p className="text-xs text-text-muted">{t("apiKeyHint")}</p>
            {provider === "opencode-go" ? (
              <p className="text-xs text-text-muted">{t("goSubscriptionHint")}</p>
            ) : null}
          </div>
          <Button type="submit" disabled={connect.isPending || !apiKey.trim()}>
            {connect.isPending
              ? t("saving")
              : existing
                ? t("replace")
                : t("connect")}
          </Button>
          {selectedProvider ? (
            <div className="rounded-md border border-dashed border-border bg-page-alt px-3 py-3">
              <p className="text-xs font-medium text-text-primary">
                {t("oauthMethodLabel")}: {oauthAvailable ? t("oauthAvailableTitle") : t("oauthUnavailableTitle")}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {oauthAvailable
                  ? handleAuthMethodsLabels(selectedProvider.authMethods)
                  : t(oauthReasonKey ?? "oauthUnavailableOAuthConditionNotMet")}
              </p>
              {!oauthAvailable ? (
                <p className="mt-1 text-xs text-text-muted">{t("oauthUnavailableHint")}</p>
              ) : null}
              <p className="mt-1 text-xs text-text-muted">{t("oauthNoCollectionNotice")}</p>
            </div>
          ) : null}
        </form>
      </SettingsSection>

      <SettingsSection title={t("connectionsTitle")}>
        {connections.length === 0 ? (
          <p className="text-sm text-text-muted">{t("noConnections")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {connections.map((connection) => {
              const catalog = providers.find(
                (p) => p.id === connection.provider,
              );
              const connectionModel = catalog?.models.find(
                (m) => m.id === connection.defaultModel,
              );
              return (
                <li
                  key={connection.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-balsa-title text-base font-semibold text-text-primary">
                        {catalog?.name ??
                          PROVIDER_LABELS[connection.provider] ??
                          connection.provider}
                      </span>
                      <StatusBadge status={connection.status} />
                      {connectionModel?.vision ? <VisionBadge /> : null}
                    </div>
                    <dl className="text-xs text-text-secondary">
                      <span>
                        {t("method")}: {connection.authMethod === "api_key" ? t("apiKeyMethodLabel") : t("oauthMethodLabel")}
                      </span>
                      <span className="mx-2">·</span>
                      <span>
                        {t("defaultModel")}: {connection.defaultModel ?? "—"}
                      </span>
                      {connection.validatedAt ? (
                        <>
                          <span className="mx-2">·</span>
                          <span>
                            {t("validatedAt")}: {new Date(connection.validatedAt).toLocaleString()}
                          </span>
                        </>
                      ) : null}
                      {connection.lastErrorCode ? (
                        <>
                          <span className="mx-2">·</span>
                          <span className="text-balsa-destructive">
                            {connection.lastErrorCode}
                          </span>
                        </>
                      ) : null}
                    </dl>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        validate.mutate(connection.provider, {
                          onSuccess: () => toastSuccess(t("validatedSuccess")),
                          onError: (error) => toastError(error.message),
                        })
                      }
                      disabled={validate.isPending}
                    >
                      {t("validate")}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        revoke.mutate(connection.provider, {
                          onSuccess: () => toastSuccess(t("revokedSuccess")),
                          onError: (error) => toastError(error.message),
                        })
                      }
                      disabled={revoke.isPending}
                    >
                      {t("revoke")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("settings.ai.status");
  return (
    <span className="rounded-balsa-control bg-balsa-primary/10 px-2 py-0.5 text-xs font-medium text-balsa-primary">
      {t(status)}
    </span>
  );
}

function VisionBadge() {
  const t = useTranslations("settings.ai");
  return (
    <span className="rounded-balsa-control bg-balsa-primary/10 px-2 py-0.5 text-xs font-medium text-balsa-primary">
      {t("vision")}
    </span>
  );
}
