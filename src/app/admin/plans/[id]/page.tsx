"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Gauge } from "lucide-react";
import {
  useAdminPlan,
  useUpdatePlan,
  useSetPlanActive,
} from "@/hooks/use-admin-plans";
import {
  useAdminPlanLimits,
  useCreatePlanLimit,
  useUpdatePlanLimit,
  useDeletePlanLimit,
} from "@/hooks/use-admin-plan-limits";
import type {
  AdminPlanLimit,
  LimitBehavior,
  LimitResource,
} from "@/hooks/use-admin-plan-limits";
import { ALL_MODULES } from "@/lib/module-gating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/shared/loading-state";
import { EmptyState } from "@/components/shared/empty-state";
import { toastSuccess, toastError } from "@/lib/toast";

const RESOURCES: LimitResource[] = ["users", "tasks", "projects", "contracts"];
const BEHAVIORS: LimitBehavior[] = ["hard", "warning"];

function behaviorVariant(behavior: LimitBehavior) {
  return behavior === "hard" ? "destructive" : "warning";
}

export default function AdminPlanDetailPage() {
  const t = useTranslations("admin.pages.planDetail");
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const {
    data: plan,
    isLoading: planLoading,
    isError: planLoadFailed,
  } = useAdminPlan(planId);
  const updatePlan = useUpdatePlan();
  const setPlanActive = useSetPlanActive();

  const [name, setName] = useState("");
  const [stripePriceId, setStripePriceId] = useState("");
  const [monthlyAiStudioCredits, setMonthlyAiStudioCredits] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  const [resource, setResource] = useState<LimitResource>("users");
  const [limit, setLimit] = useState("");
  const [behavior, setBehavior] = useState<LimitBehavior>("hard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: limits, isLoading, isError } = useAdminPlanLimits(planId);
  const createLimit = useCreatePlanLimit(planId);
  const updateLimit = useUpdatePlanLimit(planId);
  const deleteLimit = useDeletePlanLimit(planId);

  useEffect(() => {
    if (!plan) return;
    setName(plan.name);
    setStripePriceId(plan.stripePriceId ?? "");
    setMonthlyAiStudioCredits(plan.monthlyAiStudioCredits?.toString() ?? "");
    setModules(plan.allowedModules);
    setIsDefault(plan.isDefault);
  }, [plan]);

  function toggleModule(module: string) {
    setModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module]
    );
  }

  function handleSavePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    updatePlan.mutate(
      {
        id: planId,
        name: name.trim(),
        stripePriceId: stripePriceId.trim() || null,
        monthlyAiStudioCredits: monthlyAiStudioCredits.trim() === "" ? null : Number(monthlyAiStudioCredits),
        allowedModules: modules,
        isDefault,
      },
      {
        onSuccess: () => toastSuccess(t("saveSuccess")),
        onError: () => toastError(t("saveFailed")),
      }
    );
  }

  function handleSetActive(active: boolean) {
    if (
      !active &&
      !window.confirm(t("deactivateConfirm", { name: plan?.name ?? "" }))
    ) {
      return;
    }
    setPlanActive.mutate(
      { id: planId, isActive: active },
      {
        onSuccess: () => {
          toastSuccess(active ? t("activateSuccess") : t("deactivateSuccess"));
        },
        onError: () => {
          toastError(active ? t("activateFailed") : t("deactivateFailed"));
        },
      }
    );
  }

  function resetForm() {
    setEditingId(null);
    setResource("users");
    setLimit("");
    setBehavior("hard");
  }

  function startEdit(planLimit: AdminPlanLimit) {
    setEditingId(planLimit.id);
    setResource(planLimit.resource);
    setLimit(String(planLimit.limit));
    setBehavior(planLimit.behavior);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const numericLimit = Number(limit);
    if (!Number.isInteger(numericLimit) || numericLimit < 0) return;
    const payload = { resource, limit: numericLimit, behavior };
    if (editingId) {
      updateLimit.mutate({ id: editingId, ...payload }, { onSuccess: resetForm });
    } else {
      createLimit.mutate(payload, { onSuccess: resetForm });
    }
  }

  return (
    <div className="p-6" data-testid="admin-plan-detail-page">
      <Link
        href="/admin/plans"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("backToPlans")}
      </Link>
      {planLoading ? (
        <LoadingState />
      ) : planLoadFailed ? (
        <EmptyState
          icon={Gauge}
          title={t("title")}
          description={t("loadFailed")}
        />
      ) : plan ? (
        <>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-text-primary">
              {plan.name}
            </h1>
            {plan.isInternal && (
              <Badge variant="secondary">{t("internal")}</Badge>
            )}
            {plan.isActive ? (
              <Badge variant="success">{t("active")}</Badge>
            ) : (
              <Badge variant="secondary">{t("inactive")}</Badge>
            )}
          </div>
          {!plan.isInternal && (
            <div className="mb-6 flex items-center gap-2">
              {plan.isActive ? (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={setPlanActive.isPending}
                  onClick={() => handleSetActive(false)}
                >
                  {t("deactivate")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setPlanActive.isPending}
                  onClick={() => handleSetActive(true)}
                >
                  {t("activate")}
                </Button>
              )}
            </div>
          )}

          <form
            onSubmit={handleSavePlan}
            className="mb-8 space-y-4 rounded-lg border border-border p-4"
            data-testid="edit-plan-form"
          >
            <h2 className="text-heading-2 font-semibold text-text-primary">
              {t("editTitle")}
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="edit-plan-name">{t("name")}</Label>
              <Input
                id="edit-plan-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-plan-ai-credits">{t("monthlyAiStudioCredits")}</Label>
              <Input id="edit-plan-ai-credits" type="number" min={0} step={1} value={monthlyAiStudioCredits} onChange={(event) => setMonthlyAiStudioCredits(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-plan-stripe-price">{t("stripePriceId")}</Label>
              <Input
                id="edit-plan-stripe-price"
                value={stripePriceId}
                onChange={(event) => setStripePriceId(event.target.value)}
                placeholder="price_..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("modules")}</Label>
              <div className="flex flex-wrap gap-2">
                {ALL_MODULES.map((module) => (
                  <label
                    key={module}
                    className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm"
                  >
                    <Checkbox
                      checked={modules.includes(module)}
                      onCheckedChange={() => toggleModule(module)}
                    />
                    {module}
                  </label>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={isDefault}
                disabled={!plan.isActive}
                onCheckedChange={(checked) => setIsDefault(Boolean(checked))}
              />
              {t("setAsDefault")}
            </label>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={updatePlan.isPending || !name.trim()}>
                {t("save")}
              </Button>
            </div>
          </form>

          <h2 className="mb-1 text-lg font-semibold text-text-primary">
            {t("limitsTitle")}
          </h2>
          <p className="mb-6 text-sm text-text-secondary">{t("limitsDescription")}</p>

          <form
            onSubmit={submit}
            className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="limit-resource">{t("resource")}</Label>
              <Select
                value={resource}
                onValueChange={(value) => setResource(value as LimitResource)}
              >
                <SelectTrigger id="limit-resource" className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RESOURCES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`resources.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="limit-value">{t("limit")}</Label>
              <Input
                id="limit-value"
                type="number"
                min={0}
                step={1}
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className="w-32"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="limit-behavior">{t("behavior")}</Label>
              <Select
                value={behavior}
                onValueChange={(value) => setBehavior(value as LimitBehavior)}
              >
                <SelectTrigger id="limit-behavior" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BEHAVIORS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`behaviors.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                disabled={createLimit.isPending || updateLimit.isPending}
              >
                {editingId ? t("save") : t("addLimit")}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  {t("cancel")}
                </Button>
              )}
            </div>
          </form>

          {isLoading && <LoadingState />}
          {isError && (
            <EmptyState icon={Gauge} title={t("limitsTitle")} description={t("loadFailed")} />
          )}
          {!isLoading && !isError && (!limits || limits.length === 0) && (
            <EmptyState icon={Gauge} title={t("empty")} />
          )}
          {!isLoading && !isError && limits && limits.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-page-alt text-left text-xs uppercase tracking-wide text-text-secondary">
                    <th className="px-4 py-3 font-medium">{t("resource")}</th>
                    <th className="px-4 py-3 font-medium">{t("limit")}</th>
                    <th className="px-4 py-3 font-medium">{t("behavior")}</th>
                    <th className="px-4 py-3 font-medium">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {limits.map((planLimit) => (
                    <tr key={planLimit.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3 font-medium">
                        {t(`resources.${planLimit.resource}`)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{planLimit.limit}</td>
                      <td className="px-4 py-3">
                        <Badge variant={behaviorVariant(planLimit.behavior)}>
                          {t(`behaviors.${planLimit.behavior}`)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => startEdit(planLimit)}>
                            {t("edit")}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteLimit.mutate(planLimit.id)}
                          >
                            {t("delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
