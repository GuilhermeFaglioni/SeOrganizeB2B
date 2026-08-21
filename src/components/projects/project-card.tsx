"use client";

import { ChevronRight } from "lucide-react";
import { AreaBadge } from "@/components/areas/area-badge";
import type { ProjectData } from "@/hooks/use-projects";
import { useTranslations } from "next-intl";

export function ProjectCard({ project }: { project: ProjectData }) {
  const t = useTranslations("projects.card");
  return (
    <div
      data-testid="project-card"
      className="balsa-surface cursor-pointer rounded-balsa-surface p-5 transition-[transform,box-shadow,border-color] hover:border-balsa-primary hover:shadow-balsa-panel motion-safe:hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-balsa-title text-base font-semibold text-balsa-foreground">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-balsa-muted-foreground">
              {project.description}
            </p>
          )}
        </div>
        <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-balsa-muted-foreground" aria-hidden="true" />
      </div>

      <div className="flex items-center gap-3 mt-4">
        {project.area && (
          <AreaBadge name={project.area.name} color={project.area.color} />
        )}
        <span className="text-balsa-xs text-balsa-muted-foreground">
          {t("tasksCount", { count: project._count?.tasks ?? 0 })}
        </span>
      </div>
    </div>
  );
}
