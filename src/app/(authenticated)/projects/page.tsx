"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProjects, type ProjectData } from "@/hooks/use-projects";
import { ProjectGrid } from "@/components/projects/project-grid";
import { ProjectForm } from "@/components/projects/project-form";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function ProjectsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: projects } = useProjects();
  const list = (projects ?? []) as ProjectData[];
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("newProject") === "true") {
      setFormOpen(true);
      const params = new URLSearchParams(searchParams.toString());
      params.delete("newProject");
      router.replace(`/projects?${params.toString()}`);
    }
  }, [searchParams, router]);

  return (
    <div data-testid="projects-page" className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-heading-1 text-text-primary">Projects</h1>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="w-4 h-4" aria-hidden="true" />
          New Project
        </Button>
      </div>

      <ProjectGrid
        projects={list}
        onSelect={(id) => router.push(`/projects/${id}`)}
      />

      <ProjectForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}
