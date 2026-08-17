import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { fetchJson } from "@/lib/financial/http";
import { toastError } from "@/lib/toast";

export interface ClosedBetaInvitation {
  id: string;
  email: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  token?: string;
}

export function useClosedBetaInvitations() {
  return useQuery<ClosedBetaInvitation[]>({
    queryKey: ["admin", "closed-beta", "invitations"],
    queryFn: () => fetchJson<ClosedBetaInvitation[]>("/api/admin/closed-beta/invitations"),
  });
}

export function useCreateClosedBetaInvitation() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.closedBeta");
  return useMutation({
    mutationFn: (email: string) =>
      fetchJson<ClosedBetaInvitation>("/api/admin/closed-beta/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "closed-beta"] });
    },
    onError: () => toastError(t("invitationFailed")),
  });
}

export function useRevokeClosedBetaInvitation() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.closedBeta");
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<ClosedBetaInvitation>(`/api/admin/closed-beta/invitations/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "closed-beta"] });
    },
    onError: () => toastError(t("invitationFailed")),
  });
}

export function useReissueClosedBetaInvitation() {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.pages.closedBeta");
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson<ClosedBetaInvitation>(`/api/admin/closed-beta/invitations/${id}`, {
        method: "POST",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "closed-beta"] });
    },
    onError: () => toastError(t("invitationFailed")),
  });
}
