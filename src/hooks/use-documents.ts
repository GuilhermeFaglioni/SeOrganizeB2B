import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

const API = "/api/documents";

interface DocumentData {
  id: string;
  title: string;
  content: string;
  projectId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
}

export { type DocumentData };

export function useDocuments(projectId?: string | null) {
  const queryStr = projectId ? `?project_id=${projectId}` : "";
  return useQuery<DocumentData[]>({
    queryKey: ["documents", projectId],
    queryFn: () => fetchJson<DocumentData[]>(`${API}${queryStr}`),
  });
}

export function useDocument(id: string) {
  return useQuery<DocumentData>({
    queryKey: ["document", id],
    queryFn: () => fetchJson<DocumentData>(`${API}/${id}`),
    enabled: !!id,
  });
}

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { title: string; content?: string; projectId?: string }) =>
      fetchJson(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; title?: string; content?: string; projectId?: string }) =>
      fetchJson(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useAutoSave() {
  const updateDoc = useUpdateDocument();

  function scheduleSave(id: string, data: { content?: string; title?: string }) {
    if (debounceTimers[id]) {
      clearTimeout(debounceTimers[id]);
    }
    debounceTimers[id] = setTimeout(() => {
      updateDoc.mutate({ id, ...data });
    }, 3000);
  }

  function cancelSave(id: string) {
    if (debounceTimers[id]) {
      clearTimeout(debounceTimers[id]);
    }
  }

  return { scheduleSave, cancelSave, updateDoc };
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${API}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}
