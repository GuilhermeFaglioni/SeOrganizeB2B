"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSavedViews } from "@/hooks/use-saved-views";

export function TodaySavedViews() {
  const router = useRouter();
  const { data: views = [] } = useSavedViews();
  if (!views.length) return null;
  return (
    <div className="mb-5 flex items-center gap-2 overflow-x-auto">
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-text-secondary">
        <Bookmark className="h-3.5 w-3.5" /> Minhas views
      </span>
      {views.slice(0, 6).map((view) => {
        const params = new URLSearchParams();
        if (view.filters.project && view.filters.project !== "__all__") {
          params.set("project", view.filters.project);
        }
        if (view.filters.areas) params.set("areas", view.filters.areas);
        if (view.filters.filter) params.set("filter", view.filters.filter);
        if (view.filters.assignee) {
          params.set("assignee", view.filters.assignee);
        }
        if (view.filters.dateFrom) {
          params.set("dateFrom", view.filters.dateFrom);
        }
        if (view.filters.dateTo) params.set("dateTo", view.filters.dateTo);
        if (view.filters.sort && view.filters.sort !== "manual") {
          params.set("sort", view.filters.sort);
        }
        if (view.filters.group && view.filters.group !== "workflow") {
          params.set("group", view.filters.group);
        }
        return (
          <button
            key={view.id}
            onClick={() => router.push(`/board?${params.toString()}`)}
            className="shrink-0 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-text-primary shadow-card hover:border-accent hover:text-accent"
          >
            {view.name}
          </button>
        );
      })}
    </div>
  );
}
