import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getInsertPosition } from "@/lib/reorder";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export interface BoardTask {
  id: string;
  title: string;
  description?: string | null;
  priority: string;
  dueDate: string | null;
  position: number;
  columnId?: string;
  areaId?: string | null;
  createdBy?: string;
  recurrenceType?: "daily" | "weekly" | "monthly" | null;
  recurrenceInterval?: number | null;
  area: { id: string; name: string; color: string } | null;
  assignees: Array<{
    profileId: string;
    profile: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
  _count: { comments: number };
}

export interface BoardColumn {
  id: string;
  name: string;
  completesTasks?: boolean;
  tasks: BoardTask[];
}

export function useBoard(projectId: string) {
  return useQuery<BoardColumn[]>({
    queryKey: ["board", projectId],
    queryFn: () =>
      fetchJson<BoardColumn[]>(`/api/projects/${projectId}/columns?includeTasks=true`),
    enabled: Boolean(projectId && projectId !== "_"),
  });
}

export function useColumns(projectId: string) {
  const queryClient = useQueryClient();

  const addColumn = useMutation({
    mutationFn: (data: { name: string; color?: string }) =>
      fetchJson(`/api/projects/${projectId}/columns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  const renameColumn = useMutation({
    mutationFn: ({ columnId, name }: { columnId: string; name: string }) =>
      fetchJson(`/api/projects/${projectId}/columns/${columnId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  const deleteColumn = useMutation({
    mutationFn: (columnId: string) =>
      fetchJson(`/api/projects/${projectId}/columns/${columnId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  const reorderColumns = useMutation({
    mutationFn: (orderedIds: string[]) =>
      fetchJson(`/api/projects/${projectId}/columns/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
    },
  });

  return { addColumn, renameColumn, deleteColumn, reorderColumns };
}

export function useMoveTask(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      taskId,
      targetColumnId,
      beforePosition,
      afterPosition,
    }: {
      taskId: string;
      targetColumnId: string;
      beforePosition: number | null;
      afterPosition: number | null;
    }) => {
      const position = getInsertPosition(beforePosition, afterPosition);
      return fetchJson(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columnId: targetColumnId, position }),
      });
    },
    onMutate: async ({ taskId, targetColumnId }) => {
      await queryClient.cancelQueries({ queryKey: ["board", projectId] });
      const previous = queryClient.getQueryData<BoardColumn[]>(["board", projectId]);
      queryClient.setQueryData<BoardColumn[]>(["board", projectId], (old) => {
        if (!old) return old;
        let movedTask: BoardTask | undefined;
        const without = old.map((col) => {
          const task = col.tasks.find((t) => t.id === taskId);
          if (task) movedTask = task;
          return { ...col, tasks: col.tasks.filter((t) => t.id !== taskId) };
        });
        return without.map((col) => {
          if (col.id === targetColumnId && movedTask) {
            return { ...col, tasks: [...col.tasks, movedTask] };
          }
          return col;
        });
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["board", projectId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      queryClient.invalidateQueries({ queryKey: ["today-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
