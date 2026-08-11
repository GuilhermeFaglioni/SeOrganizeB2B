"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export interface PlanOption {
  id: string;
  name: string;
  allowedModules: string[];
  stripePriceId: string | null;
}

export function usePlans() {
  return useQuery<PlanOption[]>({
    queryKey: ["plans"],
    queryFn: () => fetchJson<PlanOption[]>("/api/plans"),
    staleTime: 60 * 1000,
  });
}