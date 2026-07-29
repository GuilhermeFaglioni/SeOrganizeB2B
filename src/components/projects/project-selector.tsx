"use client";

import { useRouter, useParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProjects, type ProjectData } from "@/hooks/use-projects";

export function ProjectSelector() {
  const router = useRouter();
  const params = useParams();
  const { data: projects } = useProjects();

  const currentId = params?.projectId as string | undefined;

  return (
    <div data-testid="project-selector" className="px-4 py-3">
      <span className="text-label text-sidebar-text-muted uppercase tracking-wider">
        Project
      </span>
      <Select
        value={currentId}
        onValueChange={(id) => router.push(`/board/${id}`)}
      >
        <SelectTrigger className="mt-1.5 w-full bg-sidebar-hover border-0 text-sidebar-text text-sm">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {projects?.map((p: ProjectData) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
