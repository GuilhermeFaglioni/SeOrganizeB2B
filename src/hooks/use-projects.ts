import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";

const API = "/api/projects";

interface ProjectData {
  id: string;
  name: string;
  description: string | null;
  area?: { id: string; name: string; color: string | null } | null;
  _count?: { tasks: number };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.data;
}

export type { ProjectData };

export function useProjects(options?: { enabled?: boolean }) {
  return useQuery<ProjectData[]>({
    queryKey: ["projects"],
    queryFn: () => fetchJson<ProjectData[]>(API),
    enabled: options?.enabled ?? true,
  });
}

export function useCreateProject() {
  const t = useTranslations("hooks.projects");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; description?: string; areaId?: string }) =>
      fetchJson(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toastError(t("createFailed")),
  });
}

export function useUpdateProject() {
  const t = useTranslations("hooks.projects");
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; areaId?: string }) =>
      fetchJson(`${API}/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: () => toastError(t("updateFailed")),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`${API}/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
