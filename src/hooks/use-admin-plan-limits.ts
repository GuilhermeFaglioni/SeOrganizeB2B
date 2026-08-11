import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export type LimitResource = "users" | "tasks" | "projects" | "contracts";
export type LimitBehavior = "hard" | "warning";

export interface AdminPlanLimit {
  id: string;
  planId: string;
  resource: LimitResource;
  limit: number;
  behavior: LimitBehavior;
  createdAt: string;
  updatedAt: string;
}

const limitsKey = (planId: string) => ["admin", "plans", planId, "limits"];

export function useAdminPlanLimits(planId: string) {
  return useQuery<AdminPlanLimit[]>({
    queryKey: limitsKey(planId),
    queryFn: () =>
      fetchJson<AdminPlanLimit[]>(`/api/admin/plans/${planId}/limits`),
    enabled: Boolean(planId),
  });
}

export function useCreatePlanLimit(planId: string) {
  const t = useTranslations("admin.pages.planDetail");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      resource: LimitResource;
      limit: number;
      behavior: LimitBehavior;
    }) =>
      fetchJson(`/api/admin/plans/${planId}/limits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: limitsKey(planId) });
    },
    onError: () => toastError(t("createLimitFailed")),
  });
}

export function useUpdatePlanLimit(planId: string) {
  const t = useTranslations("admin.pages.planDetail");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      resource?: LimitResource;
      limit?: number;
      behavior?: LimitBehavior;
    }) =>
      fetchJson(`/api/admin/plans/${planId}/limits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: limitsKey(planId) });
    },
    onError: () => toastError(t("updateLimitFailed")),
  });
}

export function useDeletePlanLimit(planId: string) {
  const t = useTranslations("admin.pages.planDetail");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/admin/plans/${planId}/limits/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: limitsKey(planId) });
    },
    onError: () => toastError(t("deleteLimitFailed")),
  });
}