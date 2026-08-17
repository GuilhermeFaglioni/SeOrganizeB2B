"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import {
  useAdminPlans,
  useCreatePlan,
  useSetPlanActive,
} from "@/hooks/use-admin-plans";
import type { AdminPlan } from "@/hooks/use-admin-plans";
import { ALL_MODULES } from "@/lib/module-gating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { toastSuccess, toastError } from "@/lib/toast";

export default function AdminPlansPage() {
  const t = useTranslations("admin.pages.plans");
  const { data: plans, isLoading, isError } = useAdminPlans();
  const createPlan = useCreatePlan();
  const setPlanActive = useSetPlanActive();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [stripePriceId, setStripePriceId] = useState("");
  const [modules, setModules] = useState<string[]>([]);
  const [isDefault, setIsDefault] = useState(false);

  function toggleModule(module: string) {
    setModules((current) =>
      current.includes(module)
        ? current.filter((item) => item !== module)
        : [...current, module]
    );
  }

  function resetForm() {
    setName("");
    setStripePriceId("");
    setModules([]);
    setIsDefault(false);
    setShowForm(false);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    createPlan.mutate(
      {
        name: name.trim(),
        stripePriceId: stripePriceId.trim() || null,
        allowedModules: modules,
        isDefault,
      },
      {
        onSuccess: () => {
          toastSuccess(t("createSuccess"));
          resetForm();
        },
        onError: () => toastError(t("createFailed")),
      }
    );
  }

  function handleSetActive(plan: AdminPlan, active: boolean) {
    if (!active && !window.confirm(t("deactivateConfirm", { name: plan.name }))) {
      return;
    }
    setPlanActive.mutate(
      { id: plan.id, isActive: active },
      {
        onSuccess: () => {
          toastSuccess(active ? t("activateSuccess") : t("deactivateSuccess"));
        },
        onError: () => toastError(active ? t("activateFailed") : t("deactivateFailed")),
      }
    );
  }

  const isPendingFor = (planId: string) =>
    setPlanActive.isPending && setPlanActive.variables?.id === planId;

  return (
    <div data-testid="admin-plans-page" className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-1 font-semibold text-text-primary">
          {t("title")}
        </h1>
        <Button onClick={() => setShowForm((value) => !value)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("createPlan")}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={submit}
          className="mt-6 space-y-4 rounded-lg border border-border p-4"
          data-testid="create-plan-form"
        >
          <h2 className="text-heading-2 font-semibold text-text-primary">
            {t("createTitle")}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">{t("name")}</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-stripe-price">{t("stripePriceId")}</Label>
            <Input
              id="plan-stripe-price"
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
              onCheckedChange={(checked) => setIsDefault(Boolean(checked))}
            />
            {t("setAsDefault")}
          </label>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={createPlan.isPending || !name.trim()}
            >
              {t("create")}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}

      {isLoading && <p className="mt-4 text-body-small text-text-secondary">{t("loading")}</p>}
      {isError && <p className="mt-4 text-body-small text-danger">{t("error")}</p>}
      {!isLoading && !isError && (!plans || plans.length === 0) && (
        <div className="mt-6">
          <EmptyState icon={Plus} title={t("title")} description={t("empty")} />
        </div>
      )}
      {!isLoading && !isError && plans && plans.length > 0 && (
        <table className="mt-6 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-text-secondary">
              <th className="py-2 pr-4 font-medium">{t("name")}</th>
              <th className="py-2 pr-4 font-medium">{t("modules")}</th>
              <th className="py-2 pr-4 font-medium">{t("default")}</th>
              <th className="py-2 pr-4 font-medium">{t("status")}</th>
              <th className="py-2 pr-4 font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {plans.map((plan: AdminPlan) => (
              <tr key={plan.id} className="border-b border-border">
                <td className="py-2 pr-4 text-text-primary">
                  <Link
                    href={`/admin/plans/${plan.id}`}
                    className="font-medium text-text-primary hover:text-accent hover:underline"
                  >
                    {plan.name}
                  </Link>
                  {plan.isInternal && (
                    <Badge variant="secondary" className="ml-2">
                      {t("internal")}
                    </Badge>
                  )}
                </td>
                <td className="py-2 pr-4 text-text-secondary">
                  {plan.allowedModules.length > 0
                    ? plan.allowedModules.join(", ")
                    : "—"}
                </td>
                <td className="py-2 pr-4">
                  {plan.isDefault ? (
                    <Badge variant="success">{t("yes")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("no")}</Badge>
                  )}
                </td>
                <td className="py-2 pr-4">
                  {plan.isActive ? (
                    <Badge variant="success">{t("active")}</Badge>
                  ) : (
                    <Badge variant="secondary">{t("inactive")}</Badge>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/admin/plans/${plan.id}`}>{t("edit")}</Link>
                    </Button>
                    {plan.isActive ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPendingFor(plan.id)}
                        onClick={() => handleSetActive(plan, false)}
                      >
                        {t("deactivate")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPendingFor(plan.id)}
                        onClick={() => handleSetActive(plan, true)}
                      >
                        {t("activate")}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}