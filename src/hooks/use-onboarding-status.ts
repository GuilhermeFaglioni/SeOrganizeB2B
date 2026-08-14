import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import type { WorkspaceOnboardingState } from "@/lib/onboarding/types";

export function useOnboardingStatus(options?: { enabled?: boolean }) {
  return useQuery<WorkspaceOnboardingState>({
    queryKey: ["onboarding-status"],
    queryFn: () => fetchJson<WorkspaceOnboardingState>("/api/onboarding/status"),
    enabled: options?.enabled ?? true,
    staleTime: 30 * 1000,
  });
}

export function useBindWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bindingCode: string) =>
      fetchJson<{ id: string; tenantId: string }>("/api/onboarding/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bindingCode }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-status"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
  });
}
