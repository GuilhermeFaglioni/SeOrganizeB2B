import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

interface CommentAuthor {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

interface CommentData {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: CommentAuthor;
}

export function useComments(taskId: string) {
  return useQuery<CommentData[]>({
    queryKey: ["comments", taskId],
    queryFn: () => fetchJson<CommentData[]>(`/api/tasks/${taskId}/comments`),
    enabled: !!taskId,
  });
}

export function useCreateComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { content: string }) =>
      fetchJson<CommentData>(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onMutate: async (newComment) => {
      await queryClient.cancelQueries({ queryKey: ["comments", taskId] });
      const previous = queryClient.getQueryData<CommentData[]>(["comments", taskId]);
      const optimistic: CommentData = {
        id: `optimistic-${Date.now()}`,
        taskId,
        authorId: "current",
        content: newComment.content,
        createdAt: new Date().toISOString(),
        author: { id: "current", name: "You", avatarUrl: null },
      };
      queryClient.setQueryData<CommentData[]>(["comments", taskId], (old) =>
        old ? [...old, optimistic] : [optimistic]
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["comments", taskId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}

export function useDeleteComment(taskId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (commentId: string) =>
      fetchJson(`/api/tasks/${taskId}/comments/${commentId}`, {
        method: "DELETE",
      }),
    onMutate: async (commentId) => {
      await queryClient.cancelQueries({ queryKey: ["comments", taskId] });
      const previous = queryClient.getQueryData<CommentData[]>(["comments", taskId]);
      queryClient.setQueryData<CommentData[]>(["comments", taskId], (old) =>
        old ? old.filter((c) => c.id !== commentId) : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["comments", taskId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", taskId] });
      queryClient.invalidateQueries({ queryKey: ["board"] });
    },
  });
}
