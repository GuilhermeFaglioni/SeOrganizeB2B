import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";

export type ClosedBetaStatus = "active" | "paused" | "closed";

export interface ClosedBetaConfig {
  id: string;
  status: ClosedBetaStatus;
  maxPrimaryWorkspaces: number;
  maxGuestsPerWorkspace: number;
  planId: string;
  plan: {
    id: string;
    name: string;
    isInternal: boolean;
    isActive: boolean;
    allowedModules: string[];
  };
}

export interface ClosedBetaMetrics {
  maxPrimaryWorkspaces: number;
  activePrimaryWorkspaces: number;
  reservedPrimaryWorkspaces: number;
  availablePrimaryWorkspaces: number;
}

export interface ClosedBetaResponse {
  config: ClosedBetaConfig;
  metrics: ClosedBetaMetrics;
}

export function useClosedBeta() {
  return useQuery<ClosedBetaResponse>({
    queryKey: ["admin", "closed-beta"],
    queryFn: () => fetchJson<ClosedBetaResponse>("/api/admin/closed-beta"),
  });
}

export function useUpdateClosedBeta() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.closedBeta");

  return useMutation({
    mutationFn: (input: {
      status?: ClosedBetaStatus;
      maxPrimaryWorkspaces?: number;
      maxGuestsPerWorkspace?: number;
    }) =>
      fetchJson<ClosedBetaResponse>("/api/admin/closed-beta", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["admin", "closed-beta"], data);
    },
    onError: () => toastError(t("updateFailed")),
  });
}
