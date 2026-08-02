import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";
import { fetchJson, qs } from "@/lib/financial/http";
import type { Paginated } from "@/lib/financial/types";

export interface ClientData {
  id: string;
  name: string;
  legalName: string | null;
  cpfCnpj: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  active: boolean;
  _count?: { contracts: number };
}

export interface ClientListFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  active?: boolean | "all";
  [key: string]: string | number | boolean | "all" | undefined;
}

export function useClients(filters: ClientListFilters) {
  return useQuery<Paginated<ClientData>>({
    queryKey: ["clients", filters],
    queryFn: () => fetchJson<Paginated<ClientData>>(`/api/clients${qs(filters)}`),
  });
}

export function useClient(clientId: string) {
  return useQuery<ClientData & { contracts?: unknown[] }>({
    queryKey: ["clients", clientId],
    queryFn: () => fetchJson(`/api/clients/${clientId}`),
    enabled: Boolean(clientId),
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      legalName?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      notes?: string;
    }) =>
      fetchJson("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to create client"),
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      legalName?: string;
      cpfCnpj?: string;
      email?: string;
      phone?: string;
      notes?: string;
      active?: boolean;
    }) =>
      fetchJson(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to update client"),
  });
}

export function useDeactivateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: false }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: () => toastError("Failed to deactivate client"),
  });
}
