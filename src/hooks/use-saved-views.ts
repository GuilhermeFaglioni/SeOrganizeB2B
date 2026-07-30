"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export interface BoardViewFilters {
  project?: string | null;
  areas?: string | null;
  filter?: string | null;
  assignee?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  sort?: string | null;
  group?: string | null;
}

export interface SavedView {
  id: string;
  name: string;
  scope: "board";
  filters: BoardViewFilters;
}

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || "Request failed");
  return body.data;
}

export function useSavedViews() {
  return useQuery<SavedView[]>({
    queryKey: ["saved-views", "board"],
    queryFn: () => request("/api/saved-views"),
  });
}

export function useCreateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      scope: "board";
      filters: BoardViewFilters;
    }) =>
      request("/api/saved-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["saved-views", "board"] }),
  });
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      request(`/api/saved-views/${id}`, { method: "DELETE" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["saved-views", "board"] }),
  });
}
