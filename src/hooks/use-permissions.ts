import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";
import {
  hasFinancialView,
  permissionKey,
  type ScopedPermission,
} from "@/lib/authz/permissions";

export interface PermissionsData {
  isAdmin: boolean;
  roleId: string | null;
  roleName: string | null;
  permissions: ScopedPermission[];
}

export function usePermissions() {
  return useQuery<PermissionsData>({
    queryKey: ["me", "permissions"],
    queryFn: () => fetchJson<PermissionsData>("/api/me/permissions"),
    staleTime: 60 * 1000,
  });
}

export function useCan() {
  const { data } = usePermissions();
  const can = (permission: string) => {
    if (!data) return false;
    if (data.isAdmin) return true;
    return data.permissions.some(
      (item) => permissionKey(item) === permission
    );
  };
  return { can, data };
}

export { hasFinancialView };