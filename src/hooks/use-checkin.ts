import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchJson } from "@/lib/financial/http";

export type CheckinWorkspaceStatus =
  | "pending"
  | "completed"
  | "exempt"
  | "not_applicable";

export interface CheckinQuestion {
  id: string;
  text: string;
  type: "rating" | "single_choice" | "multiple_choice" | "short_text";
  options: string[] | null;
  required: boolean;
  position: number;
  isSuggestionQuestion: boolean;
}

export interface CheckinEdition {
  id: string;
  title: string;
  status: string;
  opensAt: string | null;
  closesAt: string | null;
  questions: CheckinQuestion[];
}

export interface CheckinStatus {
  blocked: boolean;
  phase: "upcoming" | "open" | "overdue" | null;
  workspaceStatus: CheckinWorkspaceStatus;
  editionId: string | null;
  workspaceId: string;
  profileId: string;
  edition: CheckinEdition | null;
  memberSubmitted: boolean;
}

export interface CheckinSubmitResult {
  completedWorkspace: boolean;
  workspaceStatus: CheckinWorkspaceStatus;
  duplicate: boolean;
}

const checkinKey = ["closed-beta", "checkin"] as const;

export function useCheckinStatus(options?: { enabled?: boolean }) {
  return useQuery<CheckinStatus>({
    queryKey: checkinKey,
    queryFn: () => fetchJson<CheckinStatus>("/api/closed-beta/checkin"),
    enabled: options?.enabled ?? true,
  });
}

export function useSubmitCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      editionId,
      answers,
      didNotUse,
    }: {
      editionId: string;
      answers: Record<string, unknown>;
      didNotUse?: boolean;
    }) =>
      fetchJson<CheckinSubmitResult>("/api/closed-beta/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ editionId, answers, didNotUse }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: checkinKey });
    },
  });
}
