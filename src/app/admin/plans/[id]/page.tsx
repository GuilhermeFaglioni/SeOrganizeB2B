"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Gauge } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const RESOURCES: LimitResource[] = ["users", "tasks", "projects", "contracts"];
const BEHAVIORS: LimitBehavior[] = ["hard", "warning"];

function behaviorVariant(behavior: LimitBehavior) {
  return behavior === "hard" ? "destructive" : "warning";
}

export default function AdminPlanDetailPage() {
  const t = useTranslations("admin.pages.planDetail");
  const params = useParams<{ id: string }>();
  const planId = params.id;

  const [planName, setPlanName] = useState<string | null>(null);
  const [planLoadFailed, setPlanLoadFailed] = useState(false);
  const [resource, setResource] = useState<LimitResource>("users");
  const [limit, setLimit] = useState("");
  const [behavior, setBehavior] = useState<LimitBehavior>("hard");
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data: limits, isLoading, isError } = useAdminPlanLimits(planId);
  const createLimit = useCreatePlanLimit(planId);
  const updateLimit = useUpdatePlanLimit(planId);
  const deleteLimit = useDeletePlanLimit(planId);

  useEffect(() => {
    fetch(`/api/admin/plans/${planId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("failed"))))
      .then((json) => setPlanName(json.data?.name ?? null))
      .catch(() => setPlanLoadFailed(true));
  }, [planId]);

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
      <h1 className="mb-1 text-2xl font-semibold text-text-primary">
        {planLoadFailed ? t("title") : (planName ?? t("title"))}
      </h1>
      <p className="mb-6 text-sm text-text-secondary">{t("limitsTitle")}</p>

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
    </div>
  );
}