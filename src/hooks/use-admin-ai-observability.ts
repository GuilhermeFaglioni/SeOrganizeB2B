import { useQuery } from "@tanstack/react-query";
import { fetchJson, qs } from "@/lib/financial/http";
import type { AIObservabilityFilters, AIObservabilityReport } from "@/lib/ai/admin-observability";

export function useAdminAIObservability(filters: AIObservabilityFilters) {
  return useQuery<AIObservabilityReport>({
    queryKey: ["admin", "ai-observability", filters],
    queryFn: () => fetchJson<AIObservabilityReport>(`/api/admin/ai-observability${qs({ from: filters.from?.toISOString(), to: filters.to?.toISOString(), planId: filters.planId, provider: filters.provider, model: filters.model, tenantId: filters.tenantId })}`),
  });
}
