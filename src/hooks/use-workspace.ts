import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export type WorkspaceStatus = "active" | "grace_period" | "cancelled";

export interface WorkspaceLimit {
  limit: number;
  remaining: number;
  behavior: string;
}

export interface WorkspaceData {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  companyName: string | null;
  onboardingCompleted: boolean;
  status: WorkspaceStatus;
  gracePeriodEndsAt: string | null;
  plan: {
    id: string;
    name: string;
    allowedModules: string[];
  } | null;
  features: {
    allowedModules: string[];
    limits: Record<string, WorkspaceLimit>;
    usage: {
      users: number;
      tasks: number;
      projects: number;
      contracts: number;
    };
  };
}

export function useWorkspace(options?: { enabled?: boolean }) {
  return useQuery<WorkspaceData>({
    queryKey: ["workspace"],
    queryFn: () => fetchJson<WorkspaceData>("/api/workspace"),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
  });
}
