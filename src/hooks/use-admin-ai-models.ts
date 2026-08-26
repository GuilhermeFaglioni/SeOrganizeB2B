import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import type { AIModelCatalogEntry } from "@/lib/ai/model-catalog";

export type AdminAIModel = AIModelCatalogEntry;

export interface AdminAIModelInput {
  provider: string;
  model: string;
  ownershipMode: "managed" | "byok";
  vision: boolean;
  streaming: boolean;
  inputCostMicros: number;
  outputCostMicros: number;
  imageCostMicros: number;
  creditCostPerCycle: number;
  maxOutputTokens: number;
}

const key = ["admin", "ai-models"] as const;

export function useAdminAIModels() {
  return useQuery<AdminAIModel[]>({
    queryKey: key,
    queryFn: () => fetchJson<AdminAIModel[]>("/api/admin/ai-models"),
  });
}

export function useCreateAdminAIModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdminAIModelInput) => fetchJson<AdminAIModel>("/api/admin/ai-models", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useSetAdminAIModelActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => fetchJson<AdminAIModel>(`/api/admin/ai-models/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}
