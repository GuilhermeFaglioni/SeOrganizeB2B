import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type {
  ContractSummary,
  InstallmentPlanItem,
  Paginated,
} from "@/lib/financial/types";

export interface ContractDetail extends ContractSummary {
  client: { id: string; name: string };
  owner: { id: string; name: string | null; email: string } | null;
  predecessor: { id: string; code: string; title: string; status: string } | null;
  successors: Array<{ id: string; code: string; title: string; status: string }>;
  items: Array<{
    id: string;
    name: string;
    description: string | null;
    quantity: string | null;
    unit: string | null;
    price: string | null;
    position: number;
  }>;
  projects: Array<{ project: { id: string; name: string } }>;
  installments: Array<{
    id: string;
    expectedAmount: string;
    dueDate: string;
    paymentMethod: string;
    status: string;
    paidAt: string | null;
    refundOfId: string | null;
  }>;
  changes: Array<{
    id: string;
    type: string;
    delta: string;
    effectiveDate: string;
    description: string | null;
    previousValue: string;
    newValue: string;
    reason: string | null;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
  audits: Array<{
    id: string;
    field: string;
    beforeValue: unknown;
    afterValue: unknown;
    reason: string | null;
    createdAt: string;
    actor: { id: string; name: string | null; email: string } | null;
  }>;
}

export interface ContractListFilters {
  search?: string;
  status?: string;
  clientId?: string;
  projectId?: string;
  sortBy?: string;
  sortDir?: string;
  page?: number;
  pageSize?: number;
  [key: string]: string | number | undefined;
}

export function useContracts(filters: ContractListFilters) {
  return useQuery<Paginated<ContractSummary>>({
    queryKey: ["contracts", filters],
    queryFn: () =>
      fetchJson<Paginated<ContractSummary>>(`/api/contracts${qs(filters)}`),
  });
}

export function useContract(contractId: string) {
  return useQuery<ContractDetail>({
    queryKey: ["contracts", contractId],
    queryFn: () => fetchJson<ContractDetail>(`/api/contracts/${contractId}`),
    enabled: Boolean(contractId),
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      title: string;
      clientId: string;
      ownerId?: string;
      durationType: string;
      officialValue: string;
      startDate: string;
      endDate?: string | null;
      billingFrequency?: string | null;
      paymentMethod: string;
      documentUrl?: string | null;
      notes?: string | null;
      items?: Array<{
        name: string;
        description?: string | null;
        quantity?: string | null;
        unit?: string | null;
        price?: string | null;
        position: number;
      }>;
      projectIds?: string[];
    }) =>
      fetchJson("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to create contract"),
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      clientId?: string;
      ownerId?: string | null;
      durationType?: string;
      officialValue?: string;
      startDate?: string;
      endDate?: string | null;
      billingFrequency?: string | null;
      paymentMethod?: string;
      documentUrl?: string | null;
      notes?: string | null;
    }) =>
      fetchJson(`/api/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to update contract"),
  });
}

export function useDeleteContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/contracts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
    onError: () => toastError("Failed to delete contract"),
  });
}

export function useContractLifecycle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      plan,
      effectiveDate,
      retainedInstallmentIds,
    }: {
      id: string;
      action: string;
      plan?: InstallmentPlanItem[];
      effectiveDate?: string;
      retainedInstallmentIds?: string[];
    }) =>
      fetchJson(`/api/contracts/${id}/lifecycle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          plan,
          effectiveDate,
          retainedInstallmentIds,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Lifecycle action failed"),
  });
}

export function useContractChange() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      type: "upsell" | "downsell";
      delta: string;
      effectiveDate: string;
      description?: string;
      reason?: string;
      strategy: "redistribute" | "adjust";
      confirm?: boolean;
    }) =>
      fetchJson(`/api/contracts/${id}/changes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["receivables"] });
    },
    onError: () => toastError("Failed to apply contract change"),
  });
}
