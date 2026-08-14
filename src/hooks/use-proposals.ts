import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type { Paginated } from "@/lib/financial/types";

export interface ProposalItemInput {
  name: string;
  description?: string | null;
  quantity?: string | null;
  price?: string | null;
  position: number;
}

export interface ProposalData {
  id: string;
  code: string;
  token: string;
  publicSlug: string;
  title: string;
  status: string;
  htmlSnapshot: string;
  variables: Record<string, string>;
  totalValue: string | null;
  issueDate: string | null;
  validUntil: string | null;
  locale: string;
  viewedAt: string | null;
  acceptedAt: string | null;
  acceptedByName: string | null;
  rejectedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; email: string | null } | null;
  template: { id: string; name: string } | null;
  items: Array<ProposalItemInput & { id: string }>;
}

export interface ProposalTemplateData {
  id: string;
  name: string;
  html: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalListFilters {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: string;
  [key: string]: string | number | undefined;
}

export interface WorkspaceData {
  id: string;
  companyName: string | null;
  logoUrl: string | null;
  pixKey: string | null;
}

export function useProposals(
  filters: ProposalListFilters,
  options?: { enabled?: boolean },
) {
  return useQuery<Paginated<ProposalData>>({
    queryKey: ["proposals", filters],
    queryFn: () =>
      fetchJson<Paginated<ProposalData>>(`/api/proposals${qs(filters)}`),
    enabled: options?.enabled ?? true,
  });
}

export function useProposal(proposalId: string) {
  return useQuery<ProposalData>({
    queryKey: ["proposals", proposalId],
    queryFn: () => fetchJson<ProposalData>(`/api/proposals/${proposalId}`),
    enabled: Boolean(proposalId),
  });
}

export function useProposalTemplates() {
  return useQuery<ProposalTemplateData[]>({
    queryKey: ["proposal-templates"],
    queryFn: () => fetchJson<ProposalTemplateData[]>("/api/proposal-templates"),
  });
}

export function useCreateProposalTemplate() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; html: string }) =>
      fetchJson("/api/proposal-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: () => toastError(t("templateCreateFailed")),
  });
}

export function useUpdateProposalTemplate() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      html?: string;
    }) =>
      fetchJson(`/api/proposal-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: () => toastError(t("templateUpdateFailed")),
  });
}

export function useDeleteProposalTemplate() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/proposal-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposal-templates"] });
    },
    onError: () => toastError(t("templateDeleteFailed")),
  });
}

export function useCreateProposal() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      clientId: string;
      templateId?: string | null;
      variables?: Record<string, string>;
      totalValue?: string | null;
      issueDate?: string | null;
      validUntil?: string | null;
      items?: ProposalItemInput[];
    }) =>
      fetchJson("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => toastError(t("createFailed")),
  });
}

export function useUpdateProposal() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      clientId?: string;
      templateId?: string | null;
      variables?: Record<string, string>;
      totalValue?: string | null;
      issueDate?: string | null;
      validUntil?: string | null;
      items?: ProposalItemInput[];
    }) =>
      fetchJson(`/api/proposals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => toastError(t("updateFailed")),
  });
}

export function useDeleteProposal() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/proposals/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => toastError(t("deleteFailed")),
  });
}

export function useSendProposal() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/proposals/${id}/send`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => toastError(t("sendFailed")),
  });
}

export function useRejectProposal() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      fetchJson(`/api/proposals/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => toastError(t("rejectFailed")),
  });
}

export function useCloneProposal() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/proposals/${id}/clone`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["proposals"] });
    },
    onError: () => toastError(t("cloneFailed")),
  });
}

export function useWorkspace() {
  return useQuery<WorkspaceData>({
    queryKey: ["workspace-settings"],
    queryFn: () => fetchJson<WorkspaceData>("/api/settings/workspace"),
  });
}

export function useUpdateWorkspace() {
  const t = useTranslations("hooks.proposals");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { companyName?: string; logoUrl?: string; pixKey?: string }) =>
      fetchJson("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: () => toastError(t("workspaceUpdateFailed")),
  });
}
