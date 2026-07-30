"use client";

import { useProjects } from "@/hooks/use-projects";
import { useBoard } from "@/hooks/use-kanban";
import { LoadingState } from "@/components/shared/loading-state";
import { KanbanCard } from "@/components/kanban/kanban-card";
import { useRouter } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

export default function AllProjectsPage() {
  const { data: projects, isLoading } = useProjects();

  if (isLoading) return <LoadingState />;

  if (!projects || projects.length === 0) {
    return (
      <div className="p-6 text-center text-text-secondary">
        No projects yet. Create your first project to get started.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl mx-auto">
      <h1 className="text-heading-1 text-text-primary">All Projects</h1>
      <div className="space-y-6">
        {projects.map((project) => (
          <ProjectSection key={project.id} projectId={project.id} projectName={project.name} />
        ))}
      </div>
    </div>
  );
}

function ProjectSection({ projectId, projectName }: { projectId: string; projectName: string }) {
  const { data: columns } = useBoard(projectId);
  const router = useRouter();

  if (!columns) return null;

  const taskCount = columns.reduce((sum, col) => sum + col.tasks.length, 0);
  if (taskCount === 0) return null;

  return (
    <div className="bg-white border border-border rounded-xl p-5">
      <button
        onClick={() => router.push(`/board/${projectId}`)}
        className="flex items-center gap-2 text-base font-semibold text-text-primary hover:text-accent mb-4"
      >
        <LayoutDashboard size={18} />
        {projectName}
        <span className="text-sm font-normal text-text-secondary">({taskCount} tasks)</span>
      </button>
      <div className="space-y-2">
        {columns.map((col) => (
          <div key={col.id}>
            {col.tasks.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">{col.name}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
                  {col.tasks.slice(0, 5).map((task) => (
                    <KanbanCard key={task.id} task={task} />
                  ))}
                  {col.tasks.length > 5 && (
                    <div className="flex items-center justify-center text-sm text-text-secondary border border-dashed border-border rounded-lg p-3">
                      +{col.tasks.length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
