import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface ProfileData {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  roleId: string | null;
  tenantId: string;
}

export function useProfile(
  userId: string | undefined,
  options?: { enabled?: boolean },
) {
  return useQuery<ProfileData>({
    queryKey: ["profile", userId],
    queryFn: () => fetchJson<ProfileData>("/api/profile"),
    enabled: (options?.enabled ?? true) && Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });
}
