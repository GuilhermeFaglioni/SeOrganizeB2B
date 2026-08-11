import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export type TenantStatus = "active" | "grace_period" | "cancelled";

export interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  plan: { id: string; name: string } | null;
  usage: { users: number; tasks: number; projects: number };
  createdAt: string;
}

export function useAdminTenants() {
  return useQuery<AdminTenant[]>({
    queryKey: ["admin", "tenants"],
    queryFn: () => fetchJson<AdminTenant[]>("/api/admin/tenants"),
  });
}

export function useUpdateTenant() {
  const t = useTranslations("admin.pages.tenants");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      status?: TenantStatus;
      planId?: string;
      extendGracePeriod?: boolean;
    }) =>
      fetchJson(`/api/admin/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: () => toastError(t("updateFailed")),
  });
}

export function useDeleteTenant() {
  const t = useTranslations("admin.pages.tenants");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/admin/tenants/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
    },
    onError: () => toastError(t("deleteFailed")),
  });
}