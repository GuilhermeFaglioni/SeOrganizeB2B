import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import type { AIStudioConfig, AIStudioRefinementBase, UpdatedRefinedTemplateResult } from "@/lib/ai/studio-service";

export type { AIStudioConfig } from "@/lib/ai/studio-service";

export function useAIStudioConfig(options?: { enabled?: boolean }) {
  return useQuery<AIStudioConfig>({
    queryKey: ["ai-studio", "config"],
    queryFn: () => fetchJson<AIStudioConfig>("/api/ai/studio/config"),
    enabled: options?.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useAIStudioRefinementBase(templateId: string | null) {
  return useQuery<AIStudioRefinementBase>({
    queryKey: ["ai-studio", "refine", templateId],
    queryFn: () => fetchJson<AIStudioRefinementBase>(`/api/ai/studio/refine/${templateId}`),
    enabled: Boolean(templateId),
  });
}

export function useUpdateRefinedTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      html,
      confirmed,
    }: {
      templateId: string;
      html: string;
      confirmed: boolean;
    }) =>
      fetchJson<UpdatedRefinedTemplateResult>(
        `/api/ai/studio/refine/${templateId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html, confirmed }),
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
  });
}

export function useRecordAIStudioConsent() {
  return useMutation({
    mutationFn: (input: { provider: string; version: string }) =>
      fetchJson("/api/ai/studio/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, accepted: true }),
      }),
  });
}
