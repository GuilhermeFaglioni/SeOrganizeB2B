import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface AdminPlan {
  id: string;
  name: string;
  stripePriceId: string | null;
  allowedModules: string[];
  isDefault: boolean;
  isActive: boolean;
}

export function useAdminPlans() {
  return useQuery<AdminPlan[]>({
    queryKey: ["admin", "plans"],
    queryFn: () => fetchJson<AdminPlan[]>("/api/admin/plans"),
  });
}