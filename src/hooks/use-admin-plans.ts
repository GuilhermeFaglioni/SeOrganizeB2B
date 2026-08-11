import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface AdminPlan {
  id: string;
  name: string;
  stripePriceId: string | null;
  allowedModules: string[];
  isDefault: boolean;
  isActive: boolean;
}

export interface AdminPlanInput {
  name: string;
  stripePriceId?: string | null;
  allowedModules: string[];
  isDefault?: boolean;
}

export function useAdminPlans() {
  return useQuery<AdminPlan[]>({
    queryKey: ["admin", "plans"],
    queryFn: () => fetchJson<AdminPlan[]>("/api/admin/plans"),
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
      queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
    },
  });
}