"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, Plus } from "lucide-react";
import {
  useAdminAIModels,
  useCreateAdminAIModel,
  useSetAdminAIModelActive,
} from "@/hooks/use-admin-ai-models";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { toastError, toastSuccess } from "@/lib/toast";
import { useAIProviders } from "@/hooks/use-ai-connections";
import { useAdminAIProviderModels } from "@/hooks/use-admin-ai-provider-models";

const initial = {
  provider: "",
  model: "",
  ownershipMode: "managed" as const,
  vision: false,
  streaming: false,
  inputCostPerMillion: "0",
  outputCostPerMillion: "0",
  imageCostPerMillion: "0",
  creditCostPerCycle: "1",
  maxOutputTokens: "6000",
};

function parseDecimal(value: string): number {
  return Number(value.trim().replace(",", "."));
}
export default function AdminAIModelsPage() {
  const t = useTranslations("admin.pages.aiModels");
  const { data: models, isLoading, isError } = useAdminAIModels();
  const create = useCreateAdminAIModel();
  const setActive = useSetAdminAIModelActive();
  const { data: providers } = useAIProviders();
  const [form, setForm] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const set = (name: keyof typeof form, value: string | boolean) =>
    setForm((current) => ({ ...current, [name]: value }));
  const selectedProvider = providers?.find(
    (provider) => provider.id === form.provider,
  );
  const remoteModels = useAdminAIProviderModels(form.provider, {
    enabled: form.provider === "opencode-go" && showForm,
  });
  const availableModels =
    form.provider === "opencode-go"
      ? (remoteModels.data ?? [])
      : (selectedProvider?.models ?? []);

  useEffect(() => {
    if (
      form.provider &&
      availableModels.length > 0 &&
      !availableModels.some((model) => model.id === form.model)
    ) {
      set("model", availableModels[0].id);
    }
  }, [availableModels, form.model, form.provider]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload = {
      ...form,
      inputCostPerMillion: parseDecimal(form.inputCostPerMillion),
      outputCostPerMillion: parseDecimal(form.outputCostPerMillion),
      imageCostPerMillion: parseDecimal(form.imageCostPerMillion),
      creditCostPerCycle: Number(form.creditCostPerCycle),
      maxOutputTokens: Number(form.maxOutputTokens),
    };
    create.mutate(payload, {
      onSuccess: () => {
        toastSuccess(t("createSuccess"));
        setForm(initial);
        setShowForm(false);
      },
      onError: () => toastError(t("createFailed")),
    });
  }

  return (
    <div className="p-6" data-testid="admin-ai-models-page">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-1 font-semibold text-text-primary">
          {t("title")}
        </h1>
        <Button onClick={() => setShowForm((value) => !value)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newModel")}
        </Button>
      </div>
      {showForm && (
        <form
          onSubmit={submit}
          className="mt-6 grid gap-4 rounded-lg border border-border p-4 md:grid-cols-2"
          data-testid="create-ai-model-form"
        >
          <h2 className="md:col-span-2 text-heading-2 font-semibold text-text-primary">
            {t("newModel")}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-provider">{t("provider")}</Label>
            <select
              id="ai-model-provider"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.provider}
              onChange={(event) => set("provider", event.target.value)}
              required
            >
              <option value="">{t("selectProvider")}</option>
              {providers?.map((provider) => (
                <option value={provider.id} key={provider.id}>
                  {provider.name} ({provider.id})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-model">{t("model")}</Label>
            <select
              id="ai-model-model"
              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              value={form.model}
              onChange={(event) => set("model", event.target.value)}
              disabled={
                !form.provider ||
                remoteModels.isLoading ||
                availableModels.length === 0
              }
              required
            >
              <option value="">
                {remoteModels.isLoading
                  ? t("loadingProviderModels")
                  : t("selectModel")}
              </option>
              {availableModels.map((model) => (
                <option value={model.id} key={model.id}>
                  {model.id}
                </option>
              ))}
            </select>
            {remoteModels.isError && (
              <p className="text-xs text-danger">{t("providerModelsError")}</p>
            )}
          </div>
          {(
            [
              "inputCostPerMillion",
              "outputCostPerMillion",
              "imageCostPerMillion",
              "creditCostPerCycle",
              "maxOutputTokens",
            ] as const
          ).map((field) => (
            <div className="space-y-1.5" key={field}>
              <Label htmlFor={`ai-model-${field}`}>{t(field)}</Label>
              <Input
                id={`ai-model-${field}`}
                value={form[field]}
                onChange={(event) => set(field, event.target.value)}
                required
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-ownershipMode">{t("ownershipMode")}</Label>
            <select
              id="ai-model-ownershipMode"
              className="h-9 rounded-md border border-border bg-background px-3 text-sm"
              value={form.ownershipMode}
              onChange={(event) => set("ownershipMode", event.target.value)}
            >
              <option value="managed">managed</option>
              <option value="byok">byok</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.vision}
                onCheckedChange={(value) => set("vision", Boolean(value))}
              />
              {t("vision")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.streaming}
                onCheckedChange={(value) => set("streaming", Boolean(value))}
              />
              {t("streaming")}
            </label>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {t("create")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      {isLoading && (
        <p className="mt-6 text-body-small text-text-secondary">
          {t("loading")}
        </p>
      )}
      {isError && (
        <p className="mt-6 text-body-small text-danger">{t("error")}</p>
      )}
      {!isLoading && !isError && (!models || models.length === 0) && (
        <div className="mt-6">
          <EmptyState icon={Bot} title={t("title")} description={t("empty")} />
        </div>
      )}
      {!isLoading && !isError && models && models.length > 0 && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-text-secondary">
                <th className="py-2 pr-4">{t("provider")}</th>
                <th className="py-2 pr-4">{t("model")}</th>
                <th className="py-2 pr-4">{t("ownershipMode")}</th>
                <th className="py-2 pr-4">{t("version")}</th>
                <th className="py-2 pr-4">{t("creditCostPerCycle")}</th>
                <th className="py-2 pr-4">{t("status")}</th>
                <th className="py-2 pr-4">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => (
                <tr className="border-b border-border" key={model.id}>
                  <td className="py-2 pr-4">{model.provider}</td>
                  <td className="py-2 pr-4 font-medium">{model.model}</td>
                  <td className="py-2 pr-4">{model.ownershipMode}</td>
                  <td className="py-2 pr-4">{model.version}</td>
                  <td className="py-2 pr-4">{model.creditCostPerCycle}</td>
                  <td className="py-2 pr-4">
                    <Badge variant={model.isActive ? "success" : "secondary"}>
                      {model.isActive ? t("active") : t("inactive")}
                    </Badge>
                  </td>
                  <td className="py-2 pr-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setActive.mutate({
                          id: model.id,
                          isActive: !model.isActive,
                        })
                      }
                    >
                      {model.isActive ? t("deactivate") : t("activate")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
