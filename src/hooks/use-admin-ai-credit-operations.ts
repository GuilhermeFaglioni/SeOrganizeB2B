import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface AdminAICreditOperationInput {
  tenantId: string;
  operation: "grant" | "revoke" | "adjustment";
  pool: "promotional" | "subscription" | "purchased";
  quantity: number;
  reason: string;
  campaign?: string;
  expiresAt?: string;
}

export function useAdminAICreditOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tenantId, ...operation }: AdminAICreditOperationInput) =>
      fetchJson(`/api/admin/tenants/${tenantId}/ai-credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(operation),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["admin", "ai-observability"],
      }),
  });
}
