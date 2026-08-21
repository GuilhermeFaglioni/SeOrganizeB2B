import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";

export interface CheckinResponseRow {
  id: string;
  editionId: string;
  workspaceId: string;
  workspaceName: string;
  responderId: string;
  responderEmail: string;
  responderName: string | null;
  isPrimary: boolean;
  createdAt: string | null;
  answers: Record<string, unknown>;
  workspaceStatus: string;
}

export interface CheckinGroupedQuestion {
  questionId: string;
  text: string;
  type: string;
  theme: string | null;
  options: string[] | null;
  responses: Array<{ workspaceId: string; workspaceName: string; value: unknown }>;
}

export interface CheckinEditionMetrics {
  editionId: string;
  totalWorkspaces: number;
  completed: number;
  pending: number;
  exempt: number;
  completionRate: number | null;
  averageResponseSeconds: number | null;
}

export interface CheckinExportRow {
  workspaceName: string;
  responderEmail: string;
  submittedAt: string;
  questionText: string;
  questionType: string;
  theme: string | null;
  answer: string;
}

const responsesKey = (editionId: string) => ["admin", "closed-beta", "checkins", editionId, "responses"] as const;

export function useCheckinResponses(
  editionId: string | null,
  filters: { workspaceId?: string; theme?: string; from?: string; to?: string } = {},
) {
  return useQuery<CheckinResponseRow[]>({
    queryKey: [...responsesKey(editionId ?? ""), filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.workspaceId) params.set("workspaceId", filters.workspaceId);
      if (filters.theme) params.set("theme", filters.theme);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const qs = params.toString();
      return fetchJson<CheckinResponseRow[]>(
        `/api/admin/closed-beta/checkins/${editionId}/responses${qs ? `?${qs}` : ""}`,
      );
    },
    enabled: Boolean(editionId),
  });
}

export function useCheckinResponseGrouping(editionId: string | null) {
  return useQuery<CheckinGroupedQuestion[]>({
    queryKey: [...responsesKey(editionId ?? ""), "grouped"],
    queryFn: () =>
      fetchJson<CheckinGroupedQuestion[]>(
        `/api/admin/closed-beta/checkins/${editionId}/responses?mode=grouped`,
      ),
    enabled: Boolean(editionId),
  });
}

export function useCheckinResponseDetail(
  editionId: string | null,
  workspaceId: string | null,
) {
  return useQuery<CheckinResponseRow | null>({
    queryKey: [...responsesKey(editionId ?? ""), "detail", workspaceId ?? ""],
    queryFn: () =>
      fetchJson<CheckinResponseRow | null>(
        `/api/admin/closed-beta/checkins/${editionId}/responses?mode=detail&workspaceId=${encodeURIComponent(workspaceId ?? "")}`,
      ),
    enabled: Boolean(editionId && workspaceId),
  });
}

export function useCheckinEditionMetrics(editionId: string | null) {
  return useQuery<CheckinEditionMetrics>({
    queryKey: [...responsesKey(editionId ?? ""), "metrics"],
    queryFn: () =>
      fetchJson<CheckinEditionMetrics>(
        `/api/admin/closed-beta/checkins/${editionId}/responses?mode=metrics`,
      ),
    enabled: Boolean(editionId),
  });
}

export function useGrantCheckinExemption(editionId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.responses");
  return useMutation({
    mutationFn: ({ workspaceId, reason, expiresAt }: { workspaceId: string; reason: string; expiresAt: string }) =>
      fetchJson(`/api/admin/closed-beta/checkins/${editionId}/exemptions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, reason, expiresAt }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: responsesKey(editionId) }),
    onError: () => toastError(t("grantExemptionFailed")),
  });
}

export function useRevokeCheckinExemption(editionId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.responses");
  return useMutation({
    mutationFn: (workspaceId: string) =>
      fetchJson(`/api/admin/closed-beta/checkins/${editionId}/exemptions/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: responsesKey(editionId) }),
    onError: () => toastError(t("revokeExemptionFailed")),
  });
}

export function useResetCheckinResponse(editionId: string) {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.responses");
  return useMutation({
    mutationFn: (workspaceId: string) =>
      fetchJson(`/api/admin/closed-beta/checkins/${editionId}/workspaces/${workspaceId}/reset`, {
        method: "POST",
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: responsesKey(editionId) }),
    onError: () => toastError(t("resetFailed")),
  });
}

export function useExportCheckinResponses() {
  const t = useTranslations("admin.pages.responses");
  return {
    exportCsv: async (editionId: string): Promise<CheckinExportRow[] | null> => {
      try {
        return await fetchJson<CheckinExportRow[]>(
          `/api/admin/closed-beta/checkins/${editionId}/responses?mode=export`,
        );
      } catch {
        toastError(t("exportFailed"));
        return null;
      }
    },
  };
}
