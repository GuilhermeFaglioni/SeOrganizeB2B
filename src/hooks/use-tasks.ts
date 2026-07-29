import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/lib/toast";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

interface TaskFilters {
  columnId?: string;
  areaId?: string;
  assigneeId?: string;
}

export function useTasks(projectId: string, filters?: TaskFilters) {
  const params = new URLSearchParams();
  if (filters?.columnId) params.set("column_id", filters.columnId);
  if (filters?.areaId) params.set("area_id", filters.areaId);
  if (filters?.assigneeId) params.set("assignee_id", filters.assigneeId);
  const qs = params.toString();

  return useQuery({
    queryKey: ["tasks", projectId, filters],
    queryFn: () => fetchJson(`/api/projects/${projectId}/tasks${qs ? `?${qs}` : ""}`),
  });
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchJson(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: {
      title: string;
      description?: string;
      columnId: string;
      assigneeId?: string;
      areaId?: string;
      priority?: string;
      dueDate?: string;
    }) =>
      fetchJson(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: () => toastError("Failed to create task"),
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; description?: string; columnId?: string; assigneeId?: string; areaId?: string; priority?: string; dueDate?: string }) =>
      fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: () => toastError("Failed to update task"),
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/tasks/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
    onError: () => toastError("Failed to delete task"),
  });
}
