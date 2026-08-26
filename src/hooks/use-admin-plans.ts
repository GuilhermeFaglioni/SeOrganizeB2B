import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface AdminPlan {
  id: string;
  name: string;
  stripePriceId: string | null;
  allowedModules: string[];
  monthlyAiStudioCredits: number | null;
  isDefault: boolean;
  isActive: boolean;
  isInternal: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPlanInput {
  name: string;
  stripePriceId?: string | null;
  allowedModules: string[];
  monthlyAiStudioCredits?: number | null;
  isDefault?: boolean;
}

const plansKey = ["admin", "plans"] as const;

export function useAdminPlans() {
  return useQuery<AdminPlan[]>({
    queryKey: plansKey,
    queryFn: () => fetchJson<AdminPlan[]>("/api/admin/plans"),
  });
}

export function useAdminPlan(planId: string) {
  return useQuery<AdminPlan>({
    queryKey: [...plansKey, planId],
    queryFn: () => fetchJson<AdminPlan>(`/api/admin/plans/${planId}`),
    enabled: Boolean(planId),
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminPlanInput) =>
      fetchJson<AdminPlan>("/api/admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: { id: string } & Partial<AdminPlanInput & { isActive: boolean }>) =>
      fetchJson<AdminPlan>(`/api/admin/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey });
    },
  });
}

export function useSetPlanActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetchJson<AdminPlan>(`/api/admin/plans/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: plansKey });
    },
  });
}
