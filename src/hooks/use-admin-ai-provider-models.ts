import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import type { AIProviderModelData } from "./use-ai-connections";

export function useAdminAIProviderModels(
  provider: string,
  options?: { enabled?: boolean },
) {
  return useQuery<AIProviderModelData[]>({
    queryKey: ["admin", "ai-provider-models", provider],
    queryFn: () =>
      fetchJson<AIProviderModelData[]>(
        `/api/admin/ai-models/providers/${provider}/models`,
      ),
    enabled: Boolean(provider) && (options?.enabled ?? true),
    staleTime: 60_000,
  });
}
