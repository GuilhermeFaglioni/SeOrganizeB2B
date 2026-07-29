import { ProjectCard } from "@/components/projects/project-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FolderOpen } from "lucide-react";
import type { ProjectData } from "@/hooks/use-projects";

export function ProjectGrid({
  projects,
  onSelect,
}: {
  projects: ProjectData[];
  onSelect: (id: string) => void;
}) {
  if (projects.length === 0) {
    return (
      <div data-testid="empty-projects">
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create your first project to get started organizing your work."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {projects.map((project) => (
        <div key={project.id} onClick={() => onSelect(project.id)}>
          <ProjectCard project={project} />
        </div>
      ))}
    </div>
  );
}
