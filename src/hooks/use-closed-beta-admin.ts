import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";
import { useMutation } from "@tanstack/react-query";

export interface ClosedBetaWorkspace {
  enrollmentId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  workspaceStatus: string;
  owner: { id: string; email: string; name: string | null };
  activeGuests: number;
  pendingGuestInvites: number;
  maxGuests: number;
  joinedAt: string;
}

export interface ClosedBetaWorkspaceCandidate {
  id: string;
  name: string;
  slug: string;
  profiles: { id: string; name: string | null; email: string }[];
}

export interface ClosedBetaAuditEvent {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  beforeValue: unknown;
  afterValue: unknown;
  metadata: unknown;
  createdAt: string;
}

export function useClosedBetaWorkspaces() {
  return useQuery<ClosedBetaWorkspace[]>({
    queryKey: ["admin", "closed-beta", "workspaces"],
    queryFn: () => fetchJson<ClosedBetaWorkspace[]>("/api/admin/closed-beta/workspaces"),
  });
}

export function useClosedBetaAudit() {
  return useQuery<ClosedBetaAuditEvent[]>({
    queryKey: ["admin", "closed-beta", "audit"],
    queryFn: () => fetchJson<ClosedBetaAuditEvent[]>("/api/admin/closed-beta/audit"),
  });
}

export function useClosedBetaWorkspaceCandidates() {
  return useQuery<ClosedBetaWorkspaceCandidate[]>({
    queryKey: ["admin", "closed-beta", "workspace-candidates"],
    queryFn: () =>
      fetchJson<ClosedBetaWorkspaceCandidate[]>("/api/admin/closed-beta/workspaces/candidates"),
  });
}

export function useEnrollClosedBetaWorkspace() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.closedBeta");
  return useMutation({
    mutationFn: (input: { workspaceId: string; ownerProfileId: string }) =>
      fetchJson("/api/admin/closed-beta/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "closed-beta"] });
    },
    onError: () => toastError(t("workspaceFailed")),
  });
}

export function useRemoveClosedBetaWorkspace() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.closedBeta");
  return useMutation({
    mutationFn: (workspaceId: string) =>
      fetchJson(`/api/admin/closed-beta/workspaces/${workspaceId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "closed-beta"] });
    },
    onError: () => toastError(t("workspaceFailed")),
  });
}
