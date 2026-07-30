import { useQuery } from "@tanstack/react-query";
import type { PersonOption } from "@/components/people/multi-person-selector";

async function fetchProfiles(): Promise<PersonOption[]> {
  const response = await fetch("/api/profiles");
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.message);
  return payload.data;
}

export function useProfiles() {
  return useQuery<PersonOption[]>({
    queryKey: ["profiles"],
    queryFn: fetchProfiles,
    staleTime: 5 * 60 * 1000,
  });
}
