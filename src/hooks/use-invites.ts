import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";

export interface InviteData {
  id: string;
  email: string;
  status: string;
  roleId: string | null;
  createdAt: string;
  expiresAt: string;
}

export function useInvites() {
  return useQuery<InviteData[]>({
    queryKey: ["invites"],
    queryFn: () => fetchJson<InviteData[]>("/api/workspace/invites"),
  });
}

export function useCreateInvite() {
  const t = useTranslations("hooks.invites");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { email: string; roleId?: string | null }) =>
      fetchJson("/api/workspace/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: () => toastError(t("createFailed")),
  });
}

export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      fetchJson(`/api/workspace/invites/${inviteId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
  });
}
