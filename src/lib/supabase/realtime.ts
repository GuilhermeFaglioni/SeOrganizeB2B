import { createClient } from "./client";
import type { QueryClient } from "@tanstack/react-query";

export function subscribeToBoard(projectId: string, queryClient: QueryClient) {
  const supabase = createClient();

  const channel = supabase
    .channel(`board:${projectId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tasks",
        filter: `project_id=eq.${projectId}`,
      },
      () => {
        queryClient.invalidateQueries({ queryKey: ["board", projectId] });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
