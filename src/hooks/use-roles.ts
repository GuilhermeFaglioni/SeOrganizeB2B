import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toastError } from "@/lib/toast";
import { fetchJson } from "@/lib/financial/http";
import type { ScopedPermission } from "@/lib/authz/permissions";

export interface RoleData {
  id: string;
  name: string;
  permissions: ScopedPermission[];
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  isDefault: boolean;
}

export interface TeamMemberData {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  roleId: string | null;
  isOwner?: boolean;
  role: { id: string; name: string; isAdmin: boolean } | null;
  teamMemberAreas: { areaId: string; area: { id: string; name: string; color: string } }[];
}

export function useRoles() {
  return useQuery<RoleData[]>({
    queryKey: ["roles"],
    queryFn: () => fetchJson<RoleData[]>("/api/roles"),
  });
}

export function useTeam() {
  return useQuery<TeamMemberData[]>({
    queryKey: ["team"],
    queryFn: () => fetchJson<TeamMemberData[]>("/api/team"),
  });
}

export function useCreateRole() {
  const t = useTranslations("hooks.roles");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; permissions: ScopedPermission[] }) =>
      fetchJson("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => toastError(t("createFailed")),
  });
}

export function useUpdateRole() {
  const t = useTranslations("hooks.roles");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      permissions?: ScopedPermission[];
    }) =>
      fetchJson(`/api/roles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => toastError(t("updateFailed")),
  });
}

export function useDeleteRole() {
  const t = useTranslations("hooks.roles");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/roles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: () => toastError(t("deleteFailed")),
  });
}

export function useSetDefaultRole() {
  const t = useTranslations("hooks.roles");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string | null) =>
      fetchJson("/api/roles/default", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      queryClient.invalidateQueries({ queryKey: ["workspace-settings"] });
    },
    onError: () => toastError(t("defaultFailed")),
  });
}

export function useAssignRole() {
  const t = useTranslations("hooks.roles");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string | null }) =>
      fetchJson(`/api/profiles/${userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: () => toastError(t("assignFailed")),
  });
}

export function useRemoveMember() {
  const t = useTranslations("hooks.roles");
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      fetchJson(`/api/profiles/${userId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["invites"] });
    },
    onError: () => toastError(t("removeFailed")),
  });
}
