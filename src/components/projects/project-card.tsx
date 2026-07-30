import { ChevronRight } from "lucide-react";
import { AreaBadge } from "@/components/areas/area-badge";
import type { ProjectData } from "@/hooks/use-projects";

export function ProjectCard({ project }: { project: ProjectData }) {
  return (
    <div
      data-testid="project-card"
      className="cursor-pointer rounded-xl border border-border bg-white p-5 shadow-card transition-[transform,box-shadow,border-color] hover:border-brand-400 hover:shadow-elevated motion-safe:hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-text-primary truncate">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-sm text-text-secondary mt-1 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
        <ChevronRight className="w-5 h-5 text-text-muted shrink-0 mt-1" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-3 mt-4">
        {project.area && (
          <AreaBadge name={project.area.name} color={project.area.color} />
        )}
        <span className="text-caption text-text-muted">
          {project._count?.tasks ?? 0} tasks
        </span>
      </div>
    </div>
  );
}
