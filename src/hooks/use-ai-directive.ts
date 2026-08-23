import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError, toastSuccess } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export interface WorkspaceDirectiveData {
  id: string;
  tenantId: string;
  content: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

const DIRECTIVE_QUERY_KEY = ["settings", "ai", "directive"];

export function useAiDirective() {
  return useQuery<WorkspaceDirectiveData | null>({
    queryKey: DIRECTIVE_QUERY_KEY,
    queryFn: () => fetchJson<WorkspaceDirectiveData | null>("/api/settings/ai/directive"),
  });
}

export function useSaveAiDirective() {
  const t = useTranslations("hooks.ai");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      fetchJson<WorkspaceDirectiveData>("/api/settings/ai/directive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(DIRECTIVE_QUERY_KEY, data);
      toastSuccess(t("directiveSaved"));
    },
    onError: () => toastError(t("directiveSaveFailed")),
  });
}

export function useClearAiDirective() {
  const t = useTranslations("hooks.ai");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      fetchJson("/api/settings/ai/directive", { method: "DELETE" }),
    onSuccess: () => {
      queryClient.setQueryData(DIRECTIVE_QUERY_KEY, null);
      toastSuccess(t("directiveCleared"));
    },
    onError: () => toastError(t("directiveClearFailed")),
  });
}
